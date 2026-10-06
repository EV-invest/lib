import { useEffect, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Spinner,
} from "@evinvest/uikit";

const INVESTORS = [
  "Alice Moreau",
  "Bogdan Ilić",
  "Chen Wei",
  "Dana Kowalski",
  "Elif Yılmaz",
  "Farid Haddad",
  "Grace Okafor",
  "Hiro Tanaka",
];

// Stands in for a search endpoint: matches on any word's prefix (a rule the
// kit's substring filter would disagree with) and answers late.
function searchInvestors(query: string): Promise<string[]> {
  const q = query.trim().toLowerCase();
  const rows = INVESTORS.filter((name) =>
    name.toLowerCase().split(" ").some((word) => word.startsWith(q)),
  );
  return new Promise((resolve) => setTimeout(() => resolve(rows), 600));
}

function useInvestorSearch(query: string) {
  const [rows, setRows] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (query.trim() === "") {
      setRows([]);
      setLoading(false);
      return;
    }
    let stale = false;
    setLoading(true);
    void searchInvestors(query).then((next) => {
      if (stale) return;
      setRows(next);
      setLoading(false);
    });
    return () => {
      stale = true;
    };
  }, [query]);
  return { rows, loading };
}

/**
 * `shouldFilter={false}`: the rows are the "server" answer, 600 ms late. Type
 * "ch", wait for the rows, ArrowDown / Enter picks one; the highlight lands on
 * the first row when results arrive.
 */
export function CommandDemo() {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const { rows, loading } = useInvestorSearch(query);

  return (
    <div className="flex w-80 flex-col gap-2">
      <Command
        shouldFilter={false}
        search={query}
        onSearchChange={setQuery}
        className="border-border border"
      >
        <CommandInput placeholder="Search investors…" aria-label="Search investors" />
        <CommandList>
          {loading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : (
            <CommandEmpty>No investors found.</CommandEmpty>
          )}
          {rows.length > 0 ? (
            <CommandGroup heading="Investors">
              {rows.map((name) => (
                <CommandItem key={name} value={name} onSelect={setPicked}>
                  {name}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>
      <span className="text-ink-soft text-sm">Picked: {picked ?? "—"}</span>
    </div>
  );
}
