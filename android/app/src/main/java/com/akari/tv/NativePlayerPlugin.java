package com.akari.tv;

import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.annotation.Nullable;
import androidx.annotation.OptIn;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.HttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.hls.HlsMediaSource;
import androidx.media3.exoplayer.source.MediaSource;
import androidx.media3.exoplayer.upstream.DefaultLoadErrorHandlingPolicy;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.CaptionStyleCompat;
import androidx.media3.ui.PlayerView;
import androidx.media3.ui.SubtitleView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.util.WebColor;

/**
 * Player nativo (Media3/ExoPlayer) desenhado por baixo da WebView, que fica
 * transparente enquanto ele existe: a interface do player continua no HTML.
 *
 * <p>Existe porque o {@code <video>} da WebView não para o áudio na hora: o
 * Chromium para o stream AAudio com {@code requestStop}, que toca até o fim o
 * que já está no buffer (~0,5 s nesta TV). Na pausa o áudio seguia com a imagem
 * parada; no seek tocava a posição antiga sobre o vídeo novo. O ExoPlayer pausa
 * o {@code AudioTrack} na hora e descarta o buffer no seek.
 *
 * <p>Posições em segundos, relativas à fonte carregada (o JS soma o offset da
 * sessão). Todo evento leva o {@code id} do {@code load} que o gerou, para o JS
 * ignorar eventos atrasados de uma fonte já trocada.
 */
@OptIn(markerClass = UnstableApi.class)
@CapacitorPlugin(name = "NativePlayer")
public class NativePlayerPlugin extends Plugin {

    private static final long TIME_UPDATE_MS = 250;
    // Distância entre a legenda e a borda de baixo, em fração da altura da tela.
    private static final float SUBTITLE_BOTTOM_FRACTION = 0.07f;

    @Nullable private ExoPlayer player;
    @Nullable private PlayerView view;
    private int loadId;
    private long lastReportedMs = C.TIME_UNSET;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable timeUpdate = new Runnable() {
        @Override
        public void run() {
            reportTime(false);
            handler.postDelayed(this, TIME_UPDATE_MS);
        }
    };

    private final Player.Listener listener = new Player.Listener() {
        @Override
        public void onPlaybackStateChanged(int state) {
            reportState();
        }

        @Override
        public void onPlayWhenReadyChanged(boolean playWhenReady, int reason) {
            reportState();
        }

        @Override
        public void onPositionDiscontinuity(
            Player.PositionInfo oldPosition,
            Player.PositionInfo newPosition,
            int reason
        ) {
            reportTime(true);
        }

        @Override
        public void onPlayerError(PlaybackException error) {
            JSObject data = new JSObject();
            data.put("id", loadId);
            data.put("transcodeFailed", isTranscodeFailed(error));
            data.put("message", error.getMessage());
            notifyListeners("error", data);
        }
    };

    @PluginMethod
    public void load(PluginCall call) {
        String url = call.getString("url");
        Integer id = call.getInt("id");
        double start = call.getDouble("startPosition", 0.0);
        if (url == null || id == null) {
            call.reject("url e id são obrigatórios");
            return;
        }
        getBridge().executeOnMainThread(() -> {
            ExoPlayer current = ensurePlayer();
            loadId = id;
            lastReportedMs = C.TIME_UNSET;
            // Nunca 0: o Media3 trata uma posição inicial de exatamente 0 como
            // "use a posição padrão da janela" (MaskingMediaSource), e numa
            // playlist EVENT ainda crescendo ela é a borda ao vivo — com o
            // remux já adiantado, a reprodução pulava do início para perto do
            // fim do que já tinha sido gerado. 1 ms conta como posição explícita.
            current.setMediaSource(mediaSource(url), Math.max(1, Math.round(start * 1000)));
            current.prepare();
            current.setPlayWhenReady(true);
            call.resolve();
        });
    }

    @PluginMethod
    public void play(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            if (player != null) player.play();
            call.resolve();
        });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            if (player != null) player.pause();
            call.resolve();
        });
    }

    @PluginMethod
    public void seek(PluginCall call) {
        double position = call.getDouble("position", 0.0);
        getBridge().executeOnMainThread(() -> {
            if (player != null) player.seekTo(Math.round(position * 1000));
            call.resolve();
        });
    }

    @PluginMethod
    public void release(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            releasePlayer();
            call.resolve();
        });
    }

    // App em segundo plano: pausa (o JS recebe o estado e mostra os controles).
    @Override
    protected void handleOnPause() {
        if (player != null) player.pause();
    }

    @Override
    protected void handleOnDestroy() {
        releasePlayer();
    }

    private ExoPlayer ensurePlayer() {
        if (player != null) return player;
        ExoPlayer created = new ExoPlayer.Builder(getContext()).build();
        created.setAudioAttributes(
            new AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
                .build(),
            true
        );
        created.addListener(listener);

        // A view nunca recebe foco: as teclas do controle continuam indo para
        // a WebView, onde está a navegação do player.
        PlayerView createdView = new PlayerView(getContext());
        createdView.setUseController(false);
        createdView.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT);
        // Preto também nas faixas fora do vídeo (ex.: 4:3), senão aparece o
        // fundo da janela.
        createdView.setBackgroundColor(Color.BLACK);
        createdView.setShutterBackgroundColor(Color.BLACK);
        createdView.setKeepScreenOn(true);
        // Legendas soft (SRT → WebVTT): texto branco com contorno preto, sem
        // caixa de fundo — o padrão do ExoPlayer é texto numa caixa preta.
        SubtitleView subtitles = createdView.getSubtitleView();
        if (subtitles != null) {
            subtitles.setStyle(
                new CaptionStyleCompat(
                    Color.WHITE,
                    Color.TRANSPARENT,
                    Color.TRANSPARENT,
                    CaptionStyleCompat.EDGE_TYPE_OUTLINE,
                    Color.BLACK,
                    null
                )
            );
            // Folga embaixo: as falas do WebVTT vêm ancoradas na última linha,
            // colada à borda da tela, e aí o `bottomPaddingFraction` do Media3
            // não vale. O padding encolhe a área das legendas nos dois casos
            // (a fração zerada, para não somar as duas folgas).
            subtitles.setBottomPaddingFraction(0f);
            int bottomPadding = Math.round(getContext().getResources().getDisplayMetrics().heightPixels * SUBTITLE_BOTTOM_FRACTION);
            subtitles.setPadding(0, 0, 0, bottomPadding);
        }
        createdView.setFocusable(false);
        createdView.setDescendantFocusability(ViewGroup.FOCUS_BLOCK_DESCENDANTS);
        createdView.setPlayer(created);

        WebView webView = getBridge().getWebView();
        ViewGroup parent = (ViewGroup) webView.getParent();
        parent.addView(
            createdView,
            0,
            new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        );
        webView.setBackgroundColor(Color.TRANSPARENT);
        webView.requestFocus();

        player = created;
        view = createdView;
        handler.post(timeUpdate);
        return created;
    }

    private void releasePlayer() {
        handler.removeCallbacks(timeUpdate);
        if (player != null) {
            player.release();
            player = null;
        }
        if (view != null) {
            ((ViewGroup) view.getParent()).removeView(view);
            view = null;
            WebView webView = getBridge().getWebView();
            String background = getBridge().getConfig().getBackgroundColor();
            webView.setBackgroundColor(background != null ? WebColor.parseColor(background) : Color.WHITE);
        }
    }

    private void reportState() {
        if (player == null) return;
        int state = player.getPlaybackState();
        JSObject data = new JSObject();
        data.put("id", loadId);
        data.put("paused", !player.getPlayWhenReady());
        data.put("buffering", state == Player.STATE_BUFFERING);
        data.put("ended", state == Player.STATE_ENDED);
        notifyListeners("state", data);
    }

    /** Posição atual; sem {@code force}, só quando mudou (pausado não repete). */
    private void reportTime(boolean force) {
        if (player == null || player.getPlaybackState() == Player.STATE_IDLE) return;
        long positionMs = player.getCurrentPosition();
        if (!force && positionMs == lastReportedMs) return;
        lastReportedMs = positionMs;
        JSObject data = new JSObject();
        data.put("id", loadId);
        data.put("position", positionMs / 1000.0);
        notifyListeners("timeupdate", data);
    }

    private static MediaSource mediaSource(String url) {
        // A playlist é EVENT (cresce enquanto o backend transcodifica): o
        // ExoPlayer a trata como ao vivo. Velocidade fixa em 1x — sem isso ele
        // aceleraria para alcançar a "borda ao vivo".
        MediaItem item = new MediaItem.Builder()
            .setUri(url)
            .setMimeType(MimeTypes.APPLICATION_M3U8)
            .setLiveConfiguration(
                new MediaItem.LiveConfiguration.Builder().setMinPlaybackSpeed(1f).setMaxPlaybackSpeed(1f).build()
            )
            .build();
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
            .setConnectTimeoutMs(10_000)
            .setReadTimeoutMs(20_000);
        return new HlsMediaSource.Factory(http).setLoadErrorHandlingPolicy(new TranscodeErrorPolicy()).createMediaSource(item);
    }

    /** O backend respondeu 500 ({@code TRANSCODE_FAILED}) em algum ponto da cadeia de causas. */
    private static boolean isTranscodeFailed(@Nullable Throwable error) {
        return statusOf(error) == TranscodeErrorPolicy.TRANSCODE_FAILED_STATUS;
    }

    private static int statusOf(@Nullable Throwable error) {
        while (error != null) {
            if (error instanceof HttpDataSource.InvalidResponseCodeException) {
                return ((HttpDataSource.InvalidResponseCodeException) error).responseCode;
            }
            error = error.getCause();
        }
        return 0;
    }

    /**
     * Mesma política do hls.js no navegador: o backend responde 404 enquanto o
     * transcode ainda não gerou a playlist ou o segmento pedido — conta como
     * "ainda não" e repete a cada 1 s até ~30 s. O 500 é {@code TRANSCODE_FAILED}
     * (o ffmpeg morreu, a sessão não se recupera): nunca repete. Sem troca de
     * faixa por erro: a sessão tem uma rendição de vídeo só.
     */
    private static final class TranscodeErrorPolicy extends DefaultLoadErrorHandlingPolicy {

        static final int TRANSCODE_FAILED_STATUS = 500;
        private static final int NOT_READY_STATUS = 404;
        private static final int NOT_READY_RETRIES = 30;

        @Nullable
        @Override
        public FallbackSelection getFallbackSelectionFor(FallbackOptions fallbackOptions, LoadErrorInfo loadErrorInfo) {
            return null;
        }

        @Override
        public long getRetryDelayMsFor(LoadErrorInfo loadErrorInfo) {
            int status = statusOf(loadErrorInfo.exception);
            if (status == TRANSCODE_FAILED_STATUS) return C.TIME_UNSET;
            if (status == NOT_READY_STATUS) {
                return loadErrorInfo.errorCount <= NOT_READY_RETRIES ? 1000 : C.TIME_UNSET;
            }
            // Demais erros: as tentativas padrão, e depois falha (o limite
            // mínimo abaixo é o dos 404, alto demais para eles).
            if (loadErrorInfo.errorCount > DEFAULT_MIN_LOADABLE_RETRY_COUNT) return C.TIME_UNSET;
            return super.getRetryDelayMsFor(loadErrorInfo);
        }

        @Override
        public int getMinimumLoadableRetryCount(int dataType) {
            return NOT_READY_RETRIES;
        }
    }
}
