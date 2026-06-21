import { useState } from "react";
import {
  Toaster,
  toast,
  Button,
  Badge,
  Alert,
  AlertTitle,
  AlertDescription,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Label,
  Switch,
  Checkbox,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Avatar,
  AvatarFallback,
  Progress,
  Separator,
  Spinner,
  Kbd,
  type ToastPosition,
  type ToastVariant,
} from "@evinvest/uikit";

const POSITIONS: ToastPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

const TOAST_VARIANTS: ToastVariant[] = [
  "default",
  "success",
  "error",
  "info",
  "warning",
];

function fire(variant: ToastVariant) {
  const title = variant[0]!.toUpperCase() + variant.slice(1);
  const opts = { description: "Drag me sideways to dismiss, or wait it out." };
  if (variant === "default") toast(`${title} toast`, opts);
  else toast[variant](`${title} toast`, opts);
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-3">
        <h2 className="text-foreground text-lg font-semibold">{title}</h2>
        {hint ? (
          <span className="text-muted-foreground text-xs">{hint}</span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

export default function App() {
  const [position, setPosition] = useState<ToastPosition>("bottom-right");
  const [wifi, setWifi] = useState(true);
  const [agree, setAgree] = useState(false);
  const [progress, setProgress] = useState(66);

  return (
    <TooltipProvider>
      <div className="bg-background text-foreground min-h-dvh">
        <div className="mx-auto max-w-3xl space-y-12 p-6 sm:p-12">
          <header className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                @evinvest/uikit
              </h1>
              <Badge variant="success">React</Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Live viewer rendered from local source — the Dioxus mirror lives in{" "}
              <code className="text-foreground">rust/uikit-viewer</code>.
            </p>
          </header>

          <Card>
            <CardHeader>
              <CardTitle>Toaster</CardTitle>
              <CardDescription>
                Toasts pile up collapsed and <strong>spread on hover</strong>{" "}
                (Sonner-style stacking). Drag one sideways to flick it away.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {TOAST_VARIANTS.map((v) => (
                  <Button
                    key={v}
                    size="sm"
                    variant={v === "error" ? "destructive" : "secondary"}
                    onClick={() => fire(v)}
                  >
                    {v}
                  </Button>
                ))}
                <Button
                  size="sm"
                  onClick={() => {
                    fire("success");
                    fire("info");
                    fire("warning");
                  }}
                >
                  Stack ×3
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    toast("Won't auto-close", {
                      duration: Infinity,
                      description: "Dismiss it with the × or a swipe.",
                    })
                  }
                >
                  Persistent
                </Button>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Position</Label>
                <div className="flex flex-wrap gap-2">
                  {POSITIONS.map((p) => (
                    <Button
                      key={p}
                      size="sm"
                      variant={p === position ? "default" : "outline"}
                      onClick={() => setPosition(p)}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Section title="Buttons" hint="variant + size">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
          </Section>

          <Section title="Badges">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
          </Section>

          <Section title="Alert">
            <Alert>
              <AlertTitle>Heads up</AlertTitle>
              <AlertDescription>
                This kit mirrors the Rust crate's semantics.
              </AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertTitle>Something failed</AlertTitle>
              <AlertDescription>Check the console for details.</AlertDescription>
            </Alert>
          </Section>

          <Section title="Form bits">
            <div className="w-full max-w-xs space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@evinvest.com" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={wifi} onCheckedChange={setWifi} />
              Wi-Fi {wifi ? "on" : "off"}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={agree} onCheckedChange={setAgree} />
              I agree
            </label>
          </Section>

          <Section title="Select">
            <Select defaultValue="navy">
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Pick a tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="navy">Navy brand</SelectItem>
                <SelectItem value="teal">Ha Long Teal</SelectItem>
                <SelectItem value="green">Jungle Green</SelectItem>
                <SelectItem value="gold">Rice Gold</SelectItem>
              </SelectContent>
            </Select>
          </Section>

          <Section title="Tabs">
            <Tabs defaultValue="overview" className="w-full max-w-md">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="returns">Returns</TabsTrigger>
                <TabsTrigger value="risk">Risk</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="text-muted-foreground text-sm">
                A navy-led institutional base with tiered accents.
              </TabsContent>
              <TabsContent value="returns" className="text-muted-foreground text-sm">
                Headline IRR / ROI figures sit on Rice Gold.
              </TabsContent>
              <TabsContent value="risk" className="text-muted-foreground text-sm">
                Drawdowns and exposure, kept legible.
              </TabsContent>
            </Tabs>
          </Section>

          <Section title="Tooltip">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Hover me</Button>
              </TooltipTrigger>
              <TooltipContent>Floated + animated on open</TooltipContent>
            </Tooltip>
          </Section>

          <Section title="Bits & pieces">
            <Avatar>
              <AvatarFallback>EV</AvatarFallback>
            </Avatar>
            <div className="w-48 space-y-2">
              <Progress value={progress} />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setProgress((p) => Math.max(0, p - 10))}
                >
                  −
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setProgress((p) => Math.min(100, p + 10))}
                >
                  +
                </Button>
              </div>
            </div>
            <Spinner />
            <span className="text-sm">
              Press <Kbd>⌘</Kbd> <Kbd>K</Kbd>
            </span>
          </Section>
        </div>

        <Toaster position={position} />
      </div>
    </TooltipProvider>
  );
}
