import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";

interface Option {
  id: string;
  label: string;
  disabled?: boolean;
  conflictReason?: string;
}

interface MultiSelectComboboxProps {
  options: Option[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
}

export function MultiSelectCombobox({ options, selected, onChange, placeholder }: MultiSelectComboboxProps) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  const selectedOptions = options.filter((o) => selected.includes(o.id));

  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            {placeholder}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command>
            <CommandInput placeholder="ค้นหา..." />
            <CommandList>
              <CommandEmpty>ไม่พบรายการ</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    disabled={option.disabled}
                    onSelect={() => !option.disabled && toggle(option.id)}
                    className={cn(option.disabled && "cursor-not-allowed opacity-50")}
                  >
                    <Check className={cn("mr-2 h-4 w-4 shrink-0", selected.includes(option.id) ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{option.label}</span>
                    {option.conflictReason ? (
                      <Badge variant="destructive" className="ml-auto shrink-0 text-[10px]">
                        {option.conflictReason}
                      </Badge>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map((option) => (
            <Badge
              key={option.id}
              variant={option.conflictReason ? "destructive" : "secondary"}
              className="cursor-pointer"
              onClick={() => toggle(option.id)}
              title={option.conflictReason}
            >
              {option.label}
              {option.conflictReason ? ` (${option.conflictReason})` : ""} ✕
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
