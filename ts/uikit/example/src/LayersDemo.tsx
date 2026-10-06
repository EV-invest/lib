import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
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
          <DialogDescription>
            Open the menu, then Escape: the menu goes, the dialog stays. Raise a toast and click it: the dialog
            stays.
          </DialogDescription>
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

function AlertOverDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">AlertDialog over Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Position</DialogTitle>
          <DialogDescription>
            Delete, then click the dimmed area around the confirmation: it closes, this dialog stays.
          </DialogDescription>
        </DialogHeader>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="self-start">
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete the position?</AlertDialogTitle>
              <AlertDialogDescription>The dialog behind is not touched by a click on this backdrop.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep</AlertDialogCancel>
              <AlertDialogAction>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

/** Both layers mount open in one commit: the Popover must still sit above the Dialog. */
function OpenedTogether() {
  // A new key remounts the pair, so `defaultOpen` opens both again on each press.
  const [round, setRound] = useState(0);
  return (
    <>
      <Button variant="outline" onClick={() => setRound((r) => r + 1)}>
        defaultOpen parent+child
      </Button>
      {round > 0 && (
        <Dialog key={round} defaultOpen>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Opened together</DialogTitle>
              <DialogDescription>Escape closes the popover first, the dialog on the next.</DialogDescription>
            </DialogHeader>
            <Popover defaultOpen>
              <PopoverTrigger asChild>
                <Button variant="outline" className="self-start">
                  Details
                </Button>
              </PopoverTrigger>
              <PopoverContent>Opened in the dialog's own commit.</PopoverContent>
            </Popover>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/** Nested overlays: each Escape and each click away should close one layer, the top one. */
export function LayersDemo() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DialogWithMenu />
      <DrawerWithSelect />
      <AlertOverDialog />
      <OpenedTogether />
    </div>
  );
}
