import { useState } from "react";
import { Palette } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { themes, applyTheme, type Theme } from "@/lib/themes";

export default function ThemePicker() {
  const [activeId, setActiveId] = useState("gold-warm");

  const handleSelect = (theme: Theme) => {
    setActiveId(theme.id);
    applyTheme(theme);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-2 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Kleurthema kiezen"
          data-testid="button-theme-picker"
        >
          <Palette className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 max-h-[70vh] overflow-y-auto"
      >
        {themes.map((theme) => (
          <DropdownMenuItem
            key={theme.id}
            onClick={() => handleSelect(theme)}
            className={`flex items-center gap-2.5 cursor-pointer ${
              activeId === theme.id ? "bg-accent" : ""
            }`}
            data-testid={`theme-${theme.id}`}
          >
            {/* Color swatches preview */}
            <div className="flex gap-0.5 shrink-0">
              <div
                className="w-3.5 h-3.5 rounded-sm border border-black/10"
                style={{ backgroundColor: theme.preview.sidebar }}
              />
              <div
                className="w-3.5 h-3.5 rounded-sm border border-black/10"
                style={{ backgroundColor: theme.preview.bg }}
              />
              <div
                className="w-3.5 h-3.5 rounded-sm border border-black/10"
                style={{ backgroundColor: theme.preview.card }}
              />
              <div
                className="w-3.5 h-3.5 rounded-sm border border-black/10"
                style={{ backgroundColor: theme.preview.accent }}
              />
            </div>
            <span className="text-sm truncate">{theme.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
