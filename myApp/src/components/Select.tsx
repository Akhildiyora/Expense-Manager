import React, { useState, useRef, useEffect } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'

interface Option {
  value: string
  label: string
  isHeader?: boolean
  className?: string
}


interface SelectProps {
  label?: string
  value: string
  onChange: (value: string) => void
  options: Option[]
  className?: string
  placeholder?: string
}

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  onChange,
  options,
  className = '',
  placeholder = 'Select option'
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(o => o.value === value)
  
  // Handle complex values like "date-desc" by first checking exact match, 
  // then maybe partial if needed, but for now exact match is fine.
  // If value is empty, show placeholder.

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-left text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition flex items-center justify-between hover:bg-slate-800 hover:border-slate-600"
      >
        <span className={`truncate mr-2 ${selectedOption ? 'text-slate-200' : 'text-slate-500'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDownIcon className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl max-h-60 overflow-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
          <ul className="py-1">
            {options.map((option, index) => {
              if (option.isHeader) {
                 return (
                    <li key={index} className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-900/30 border-y border-slate-700/50 my-1 first:mt-0 first:border-t-0">
                       {option.label}
                    </li>
                 )
              }
              return (
                <li
                  key={option.value}
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                  }}
                  className={`px-4 py-2 text-sm cursor-pointer transition flex items-center justify-between ${
                    value === option.value
                      ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-slate-100'
                  } ${option.className || ''}`}
                >
                  <span className="truncate">{option.label}</span>
                  {value === option.value && (
                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 ml-2"></div>
                  )}
                </li>
              )
            })}
            {options.length === 0 && (
                <li className="px-4 py-3 text-sm text-slate-500 text-center italic">
                    No options available
                </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
