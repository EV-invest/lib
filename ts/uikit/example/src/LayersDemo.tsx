import {
  Button,
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@evinvest/uikit";

const USERS = ["Alice Moreau", "Chen Wei", "Grace Okafor"];

function DialogWithMenu() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Dialog with a menu</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Position</DialogTitle>
          <DialogDescription>Open the menu, then Escape: the menu goes, the dialog stays.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Actions</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Rename</DropdownMenuItem>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuItem variant="destructive">Archive</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={() => toast("Saved", { duration: Infinity })}>
            Raise a toast
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DrawerWithSelect() {
  return (
    <Drawer direction="right">
      <DrawerTrigger asChild>
        <Button variant="outline">Drawer with a Select</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Allocation</DrawerTitle>
          <DrawerDescription>
            Open the Select or the picker, then Escape or click the panel: only the list closes.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-3 px-4">
          <Select>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a">Class A</SelectItem>
              <SelectItem value="b">Class B</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-48">
                Pick a user
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0">
              <Command>
                <CommandInput placeholder="Search users" />
                <CommandList>
                  <CommandEmpty>No one</CommandEmpty>
                  {USERS.map((u) => (
                    <CommandItem key={u} value={u}>
                      {u}
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** Nested overlays: each Escape and each click away should close one layer, the top one. */
export function LayersDemo() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DialogWithMenu />
      <DrawerWithSelect />
    </div>
  );
}
