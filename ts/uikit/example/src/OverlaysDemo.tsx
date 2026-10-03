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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  ListRow,
  ListRows,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@evinvest/uikit";

/**
 * Open and close each with the mouse: the scrim should fade with the panel and
 * never flash back to full dark, and the × should show no ring (Tab to it does).
 * With "reduce motion" on, all three fade in place.
 */
export function OverlaysDemo() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline">Sheet</Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Lead</SheetTitle>
            <SheetDescription>The panel takes focus; the first Tab reaches “Call”.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4">
            <Button>Call</Button>
            <ListRows>
              <ListRow label="Stage" value="new" />
              <ListRow label="Price" value="1,250" />
            </ListRows>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
            <DialogDescription>Focus lands on the field.</DialogDescription>
          </DialogHeader>
          <Input aria-label="Name" defaultValue="Aquafix" />
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline">Alert dialog</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke the key?</AlertDialogTitle>
            <AlertDialogDescription>Requests signed with it start failing at once.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction>Revoke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
