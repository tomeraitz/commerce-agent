interface SuggestionChipsProps {
  onPick: (text: string) => void;
}

const CHIPS: readonly string[] = [
  "I'm looking for a new smartphone",
  "Show me laptops under $2000",
  "Recommend a gift under $50",
  "Find me sunglasses under $30",
];

export function SuggestionChips({ onPick }: SuggestionChipsProps) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="suggestion-chips">
      {CHIPS.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onPick(chip)}
          className="rounded-full bg-surface border border-border text-sm text-text px-4 py-2 hover:bg-primary-soft transition-colors"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

export default SuggestionChips;
