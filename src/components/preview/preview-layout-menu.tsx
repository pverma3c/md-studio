import { SlidersHorizontalIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DEFAULT_SETTINGS,
  useAppStore,
  type PreviewDensity,
  type PreviewStyle,
  type PreviewWidth,
} from "@/store/app-store"

const STYLES: { value: PreviewStyle; label: string }[] = [
  { value: "document", label: "Document" },
  { value: "app", label: "App UI" },
]

const WIDTHS: { value: PreviewWidth; label: string }[] = [
  { value: "narrow", label: "Narrow" },
  { value: "medium", label: "Medium" },
  { value: "wide", label: "Wide" },
  { value: "full", label: "Full" },
]

const DENSITIES: { value: PreviewDensity; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
  { value: "spacious", label: "Spacious" },
]

export function PreviewLayoutMenu() {
  const width = useAppStore((s) => s.settings.previewWidth)
  const padding = useAppStore((s) => s.settings.previewPadding)
  const density = useAppStore((s) => s.settings.previewDensity)
  const style = useAppStore((s) => s.settings.previewStyle)
  const setSettings = useAppStore((s) => s.setSettings)
  const isDefault =
    width === DEFAULT_SETTINGS.previewWidth &&
    padding === DEFAULT_SETTINGS.previewPadding &&
    density === DEFAULT_SETTINGS.previewDensity

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Preview layout">
              <SlidersHorizontalIcon />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Layout</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80 gap-4 p-4">
        <PopoverHeader>
          <PopoverTitle>Preview layout</PopoverTitle>
          <PopoverDescription>
            Style, width and spacing of the rendered page.
          </PopoverDescription>
        </PopoverHeader>
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel id="preview-style-label">Style</FieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={0}
              className="w-full"
              value={style}
              onValueChange={(v) =>
                v && setSettings({ previewStyle: v as PreviewStyle })
              }
              aria-labelledby="preview-style-label"
            >
              {STYLES.map((s) => (
                <ToggleGroupItem
                  key={s.value}
                  value={s.value}
                  className="flex-1"
                >
                  {s.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <Field>
            <FieldLabel id="preview-width-label">Content width</FieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={0}
              className="w-full"
              value={width}
              onValueChange={(v) =>
                v && setSettings({ previewWidth: v as PreviewWidth })
              }
              aria-labelledby="preview-width-label"
            >
              {WIDTHS.map((w) => (
                <ToggleGroupItem
                  key={w.value}
                  value={w.value}
                  className="flex-1"
                >
                  {w.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="preview-padding">Padding</FieldLabel>
              <span className="text-xs text-muted-foreground tabular-nums">
                {padding}px
              </span>
            </div>
            <Slider
              id="preview-padding"
              min={0}
              max={96}
              step={4}
              value={[padding]}
              onValueChange={([v]) => setSettings({ previewPadding: v })}
            />
          </Field>
          <Field>
            <FieldLabel id="preview-density-label">Spacing</FieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={0}
              className="w-full"
              value={density}
              onValueChange={(v) =>
                v && setSettings({ previewDensity: v as PreviewDensity })
              }
              aria-labelledby="preview-density-label"
            >
              {DENSITIES.map((d) => (
                <ToggleGroupItem
                  key={d.value}
                  value={d.value}
                  className="flex-1"
                >
                  {d.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
        </FieldGroup>
        <Button
          variant="ghost"
          size="sm"
          className="self-end"
          disabled={isDefault}
          onClick={() =>
            setSettings({
              previewWidth: DEFAULT_SETTINGS.previewWidth,
              previewPadding: DEFAULT_SETTINGS.previewPadding,
              previewDensity: DEFAULT_SETTINGS.previewDensity,
            })
          }
        >
          Reset
        </Button>
      </PopoverContent>
    </Popover>
  )
}
