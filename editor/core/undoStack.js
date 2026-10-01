// undoStack.js — command-pattern undo/redo.
// A command is {label, undo(), redo()}; push() records an already-applied command.
export class UndoStack {
    constructor(bus, limit = 200) {
        this.bus = bus;
        this.limit = limit;
        this.undoList = [];
        this.redoList = [];
    }
    push(command) {
        this.undoList.push(command);
        if (this.undoList.length > this.limit) this.undoList.shift();
        this.redoList = [];
        this.changed();
    }
    canUndo() {
        return this.undoList.length > 0;
    }
    canRedo() {
        return this.redoList.length > 0;
    }
    undo() {
        const cmd = this.undoList.pop();
        if (!cmd) return;
        cmd.undo();
        this.redoList.push(cmd);
        this.changed();
    }
    redo() {
        const cmd = this.redoList.pop();
        if (!cmd) return;
        cmd.redo();
        this.undoList.push(cmd);
        this.changed();
    }
    clear() {
        this.undoList = [];
        this.redoList = [];
        this.changed();
    }
    changed() {
        if (this.bus) this.bus.emit("undo-changed");
    }
}
