import styled from 'styled-components'
import { Container } from '../../atoms/Container/Container'
import { Text } from '../../atoms/Text/Text'
import { Link } from '../../atoms/Link/Link'

const StyledFooter = styled.footer`
  background: ${({ theme }) => theme.colors.surface};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`
export function Footer() {
  return (
    <StyledFooter>
      <Container>
        <Text variant="caption">
          Company data from the Finnish Patent and Registration Office (PRH), licensed under{' '}
          <Link href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">
            CC BY 4.0
          </Link>
          .
        </Text>
      </Container>
    </StyledFooter>
  )
}
