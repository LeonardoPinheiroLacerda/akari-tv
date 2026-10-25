import { createMemoryRouter } from 'react-router-dom'
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
    ],
  },
])
