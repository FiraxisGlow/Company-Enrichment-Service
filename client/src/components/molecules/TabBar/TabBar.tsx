import { useRef, type KeyboardEvent } from 'react'
import styled from 'styled-components'
import { Tab } from '../../atoms/Tab/Tab'

const List = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space.xs};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`

type TabBarProps<T extends string> = {
  label: string
  tabs: { id: T; label: string }[]
  selectedId: T
  onSelect: (id: T) => void
}

export function TabBar<T extends string>({ label, tabs, selectedId, onSelect }: TabBarProps<T>) {
  const buttons = useRef(new Map<string, HTMLButtonElement>())

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((t) => t.id === selectedId)
    let next: number
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    else return

    event.preventDefault()
    const target = tabs[next]
    if (!target) return
    onSelect(target.id)
    buttons.current.get(target.id)?.focus()
  }

  return (
    <List role="tablist" aria-label={label} onKeyDown={handleKeyDown}>
      {tabs.map((tab) => {
        const selected = tab.id === selectedId
        return (
          <Tab
            key={tab.id}
            ref={(el) => {
              if (el) buttons.current.set(tab.id, el)
              else buttons.current.delete(tab.id)
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            $selected={selected}
            onClick={() => onSelect(tab.id)}
          >
            {tab.label}
          </Tab>
        )
      })}
    </List>
  )
}
