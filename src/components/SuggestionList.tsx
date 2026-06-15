interface SuggestionListProps {
  suggestions: string[];
}

export function SuggestionList({ suggestions }: SuggestionListProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
        Sugerencias:
      </p>
      <ul className="flex flex-col gap-1">
        {suggestions.map((s, i) => (
          <li
            key={i}
            className="rounded-md bg-primary/5 px-2.5 py-1.5 text-xs text-text dark:bg-primary/10 dark:text-darkText"
          >
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
