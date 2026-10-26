import type { ReactNode } from 'react'
import styled from 'styled-components'
import { Container } from '../../atoms/Container/Container'

// Takes the space between header and footer; scrolls only as a fallback on very short screens
const StyledMain = styled.main`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
`

// Passes the available height down so a page can give one section the remaining space
const Content = styled(Container)`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding-block: ${({ theme }) => theme.space.lg};
`

export function MainContent({ children }: { children: ReactNode }) {
  return (
    <StyledMain>
      <Content>{children}</Content>
    </StyledMain>
  )
}
