import styled from 'styled-components'
import { Container } from '../../atoms/Container/Container'
import { Text } from '../../atoms/Text/Text'

const StyledHeader = styled.header`
  background: ${({ theme }) => theme.colors.surface};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`

export function Header() {
  return (
    <StyledHeader>
      <Container>
        <Text variant="heading" as="div">
          Company data enricher.
        </Text>
        <Text variant="caption">Enrich company data from the PRH register against your CSV.</Text>
      </Container>
    </StyledHeader>
  )
}
