import { ThemeProvider } from 'styled-components'
import { MatchPage } from './components/pages/MatchPage/MatchPage'
import { GlobalStyle } from './theme/GlobalStyle'
import { theme } from './theme/theme'

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <MatchPage />
    </ThemeProvider>
  )
}
