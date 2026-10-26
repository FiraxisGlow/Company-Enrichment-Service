import type { ReactNode } from 'react'
import styled from 'styled-components'
import { Footer } from '../../organisms/Footer/Footer'
import { Header } from '../../organisms/Header/Header'
import { MainContent } from '../../organisms/MainContent/MainContent'

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100dvh;
`

export function PageTemplate({ children }: { children: ReactNode }) {
  return (
    <Layout>
      <Header />
      <MainContent>{children}</MainContent>
      <Footer />
    </Layout>
  )
}
