import { createMemoryRouter } from 'react-router-dom'
import { AnimeRoute } from '@/features/anime/anime-screen'
import { EpisodesRoute } from '@/features/episodes/episodes-screen'
import { HomeScreen } from '@/features/home/home-screen'
import { PlaybackRoute } from '@/features/playback/playback-screen'
import { ProfilesScreen } from '@/features/profiles/profiles-screen'
import { SearchScreen } from '@/features/search/search-screen'
import { AppLayout } from './app-layout'

// A seleção de perfis abre o app, fora da casca com a sidebar: escolher um
// perfil monta a casca do zero, e voltar a ela desmonta todas as telas.
export const router = createMemoryRouter([
  { path: '/', element: <ProfilesScreen /> },
  {
    element: <AppLayout />,
    children: [
      { path: 'home', element: <HomeScreen /> },
      { path: 'search', element: <SearchScreen /> },
      { path: 'anime/:anilistId', element: <AnimeRoute /> },
      { path: 'anime/:anilistId/episodes', element: <EpisodesRoute /> },
      { path: 'play/:fileId', element: <PlaybackRoute /> },
    ],
  },
])
