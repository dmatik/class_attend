import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn utility', () => {
    it('merges tailwind classes correctly', () => {
        const result = cn('px-2 py-1', 'bg-red-500')
        expect(result).toBe('px-2 py-1 bg-red-500')
    })

    it('handles conditional classes', () => {
        const result = cn('px-2', true && 'py-1', false && 'bg-red-500')
        expect(result).toBe('px-2 py-1')
    })

    it('merges conflicting tailwind classes (uses tailwind-merge)', () => {
        const result = cn('px-2 p-4')
        expect(result).toBe('p-4')
    })
})
