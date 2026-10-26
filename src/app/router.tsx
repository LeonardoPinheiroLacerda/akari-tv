import { createMemoryRouter } from 'react-router-dom'
import { AnimeRoute } from '@/features/anime/anime-screen'
import { EpisodesRoute } from '@/features/episodes/episodes-screen'
import { HomeScreen } from '@/features/home/home-screen'
import { SearchScreen } from '@/features/search/search-screen'
import { AppLayout } from './app-layout'

export const router = createMemoryRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'search', element: <SearchScreen /> },
      { path: 'anime/:anilistId', element: <AnimeRoute /> },
      { path: 'anime/:anilistId/episodes', element: <EpisodesRoute /> },
    ],
  },
])
