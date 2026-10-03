import "./FilterBar.css";

interface Choice {
  readonly value: string;
  readonly label: string;
}
interface Props {
  readonly label: string;
  readonly choices: readonly Choice[];
  readonly value: string;
  readonly name: string;
}

export function FilterBar({ label, choices, value, name }: Props) {
  return (
    <nav className="filter-bar" aria-label={label}>
      {choices.map((choice) => (
        <button
          type="submit"
          key={choice.value}
          name={name}
          value={choice.value}
          aria-pressed={choice.value === value}
        >
          {choice.label}
        </button>
      ))}
    </nav>
  );
}
