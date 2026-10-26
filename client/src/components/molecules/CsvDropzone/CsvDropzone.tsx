import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import styled from 'styled-components'
import { Button } from '../../atoms/Button/Button'
import { Text } from '../../atoms/Text/Text'

const MAX_BYTES = 5 * 1024 * 1024 // matches the server's upload limit

const DropArea = styled.div<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space.sm};
  padding: ${({ theme }) => theme.space.xl};
  text-align: center;
  border: 2px dashed ${({ theme, $active }) => ($active ? theme.colors.accent : theme.colors.border)};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme, $active }) => ($active ? theme.colors.dropActive : theme.colors.surface)};
  transition:
    background 0.15s,
    border-color 0.15s;
`

const HiddenInput = styled.input`
  display: none;
`

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type CsvDropzoneProps = {
  file: File | null
  onFileSelect: (file: File) => void
  disabled?: boolean
}

export function CsvDropzone({ file, onFileSelect, disabled = false }: CsvDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  function acceptFile(candidate: File | null | undefined) {
    if (!candidate) return
    if (!candidate.name.toLowerCase().endsWith('.csv')) {
      setProblem('Only .csv files are supported.')
      return
    }
    if (candidate.size > MAX_BYTES) {
      setProblem('The file is larger than 5 MB.')
      return
    }
    setProblem(null)
    onFileSelect(candidate)
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    acceptFile(event.target.files?.item(0))
    event.target.value = '' // lets the same file be chosen again
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    if (!disabled) acceptFile(event.dataTransfer.files.item(0))
  }

  return (
    <DropArea
      $active={dragging && !disabled}
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <Text variant="body">{file ? file.name : 'Drag a CSV file here'}</Text>
      <Text variant="caption">
        {file ? formatSize(file.size) : 'or choose one from your computer (UTF-8, max 5 MB)'}
      </Text>
      <Button type="button" $variant="secondary" disabled={disabled} onClick={() => inputRef.current?.click()}>
        {file ? 'Choose a different file' : 'Choose CSV file'}
      </Button>
      <HiddenInput
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        aria-label="CSV file"
        disabled={disabled}
        onChange={handleChange}
      />
      {problem && <Text variant="error">{problem}</Text>}
    </DropArea>
  )
}
