import { createMemoryRouter } from 'react-router-dom'
import { PlaceholderScreen } from './placeholder-screen'

export const router = createMemoryRouter([
  {
    path: '/',
    element: <PlaceholderScreen />,
  },
])
