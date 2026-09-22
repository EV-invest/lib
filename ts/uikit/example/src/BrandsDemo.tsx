import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  FieldLabel,
  Input,
  Logo,
  NativeSelect,
  NativeSelectOption,
  PortalProvider,
  Section,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  type Polarity,
} from "@evinvest/uikit";

/**
 * One brand scope: `data-brand` picks the palette and the mark, and the
 * PortalProvider mounts every overlay opened inside it into the scope's own
 * overlay root — portaled to `document.body`, a Dialog would paint in the
 * root palette instead.
 */
function BrandScope({ brand, polarity }: { brand: string; polarity: Polarity }) {
  const [overlays, setOverlays] = useState<HTMLDivElement | null>(null);
  return (
    // `font-sans` on the scope: the page's base family resolved on <html>, so
    // a brand's `--brand-font-sans` reaches text only through a utility below it
    <div data-brand={brand} data-testid={`brand-${brand}-${polarity}`} className="font-sans">
      <PortalProvider container={overlays}>
        {/* the overlay root sits inside the polarity too, or a dialog opened
            from a dark band would come up in the brand's light values */}
        <Section polarity={polarity} tight className="space-y-4 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <Logo className="h-8 w-auto text-primary-ink" />
            <span className="font-semibold">{brand}</span>
            <Badge variant="outline">{polarity}</Badge>
          </div>
          <BrandCard id={`${brand}-${polarity}`} brand={brand} />
          <LeadForm />
          <div ref={setOverlays} />
        </Section>
      </PortalProvider>
    </div>
  );
}

function BrandCard({ id, brand }: { id: string; brand: string }) {
  const [on, setOn] = useState(true);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Same components, {brand}'s tokens</CardTitle>
        <CardDescription>Borders, hover and the focus ring follow this palette's ink.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button>Primary</Button>
        <Button variant="outline">Outline</Button>
        <Switch checked={on} onCheckedChange={setOn} aria-label="toggle" />
        <Select defaultValue="one">
          <SelectTrigger className="w-40" data-testid={`select-${id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="one">one</SelectItem>
            <SelectItem value="two">two</SelectItem>
          </SelectContent>
        </Select>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary" data-testid={`dialog-${id}`}>
              Open dialog
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{brand}</DialogTitle>
              <DialogDescription>Portaled into the brand scope, so it keeps the palette.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/**
 * A landing page's lead form: a real `<select>` and `Field`-minted ids, so it
 * posts and stays labelled before any script runs. Tab through it to see the
 * focus ring on each palette.
 */
function LeadForm() {
  return (
    <form action="#" onSubmit={(e) => e.preventDefault()} className="flex flex-wrap items-end gap-3">
      <Field className="w-48">
        <FieldLabel>Service</FieldLabel>
        <NativeSelect name="service" placeholder="Pick one" required wrapperClassName="w-full">
          <NativeSelectOption value="leak">Leak</NativeSelectOption>
          <NativeSelectOption value="boiler">Boiler</NativeSelectOption>
        </NativeSelect>
      </Field>
      <Field className="w-48">
        <FieldLabel>Phone</FieldLabel>
        <Input name="phone" type="tel" />
      </Field>
      <Button type="submit">Request a call</Button>
    </form>
  );
}

export function BrandsDemo() {
  return (
    <div className="space-y-4">
      <BrandScope brand="ev" polarity="dark" />
      <BrandScope brand="aquafix-demo" polarity="light" />
      <BrandScope brand="aquafix-demo" polarity="dark" />
    </div>
  );
}
