// commands.js — the event command registry: palette layout, default
// parameters, editing dialogs and how each command is laid out as list lines.
import { h, deepClone } from "../ui/dom.js";
import { openDialog } from "../ui/dialog.js";
import { textArea, textInput, numberInput, checkbox, selectInput, field, button, ListBox, pickerButton } from "../ui/widgets.js";
import { Form, DIRECTIONS } from "./commandForms.js";
import { CONTINUATION_CODES, BALLOONS, BLEND, EASING } from "./format.js";
import { databasePicker } from "../ui/pickers.js";

//-----------------------------------------------------------------------------
// Block helpers

export function blockEnd(list, i) {
    const indent = list[i].indent;
    let j = i + 1;
    while (j < list.length && (list[j].indent > indent || (list[j].indent === indent && CONTINUATION_CODES.has(list[j].code)))) j++;
    return j;
}

// Returns child segments of a block split at the given separator codes.
// e.g. for If: [{head: 111 line, children:[...]}, {head: 411, children}, {head: 412}]
function segments(block, separators) {
    const indent = block[0].indent;
    const segs = [];
    let current = { head: block[0], children: [] };
    for (let k = 1; k < block.length; k++) {
        const line = block[k];
        if (line.indent === indent && separators.includes(line.code)) {
            segs.push(current);
            current = { head: line, children: [] };
        } else {
            current.children.push(line);
        }
    }
    segs.push(current);
    return segs;
}

const line = (code, indent, parameters = []) => ({ code, indent, parameters });
const empty = indent => [line(0, indent)];

function reindent(lines, delta) {
    return lines.map(l => ({ ...deepClone(l), indent: l.indent + delta }));
}

function childrenOr(children, indent) {
    return children && children.length ? children : empty(indent + 1);
}

//-----------------------------------------------------------------------------
// Registry

export const COMMANDS = new Map();

function def(code, name, tab, group, spec) {
    COMMANDS.set(code, { code, name, tab, group, ...spec });
}

export function commandDef(code) {
    return COMMANDS.get(code);
}

// Generic dialog for form-based commands.
async function formDialog(ctx, title, state, build, options = {}) {
    const params = deepClone(state.params);
    const form = new Form(ctx, params);
    const body = build(form, params, state);
    const ok = await openDialog({ title, body: h("div", { class: "col", style: { minWidth: (options.width || 360) + "px" } }, body), id: "cmd-" + title });
    if (!ok) return undefined;
    return { ...state, params };
}

function simple(code, name, tab, group, defaults, build, extra = {}) {
    def(code, name, tab, group, {
        defaults: () => deepClone(defaults),
        edit: build ? (ctx, state) => formDialog(ctx, name, state, build, extra) : null,
        ...extra
    });
}

//=============================================================================
// Tab 1: Message, Game Progression, Flow Control, Party, Actor

// Show Text
def(101, "Show Text…", 1, "Message", {
    defaults: () => ["", 0, 0, 2, ""],
    read: block => ({ params: deepClone(block[0].parameters), text: block.filter(l => l.code === 401).map(l => l.parameters[0]).join("\n") }),
    build: (state, indent) => {
        const lines = [line(101, indent, state.params)];
        const textLines = state.text.split("\n");
        for (const t of textLines) lines.push(line(401, indent, [t]));
        return lines;
    },
    edit: async (ctx, state) => {
        const p = deepClone(state.params);
        while (p.length < 5) p.push(p.length === 4 ? "" : 0);
        const f = new Form(ctx, p);
        let text = state.text || "";
        const ta = textArea(text, v => (text = v), { rows: 6, width: 520 });
        ta.style.fontSize = "14px";
        const preview = h("canvas", { width: 520, height: 140, style: { background: "#1a2a50", borderRadius: "4px" } });
        const drawPreview = () => {
            const c = preview.getContext("2d");
            c.clearRect(0, 0, preview.width, preview.height);
            c.font = "18px sans-serif";
            c.fillStyle = "#fff";
            text.split("\n").slice(0, 4).forEach((t, i) => c.fillText(t.replace(/\\[A-Z]+\[\d+\]|\\[{}.|!><^$]/gi, ""), p[0] ? 150 : 12, 30 + i * 30));
        };
        ta.addEventListener("input", drawPreview);
        drawPreview();
        const ok = await openDialog({
            title: "Show Text",
            id: "cmd-show-text",
            body: h(
                "div",
                { class: "col" },
                h(
                    "div",
                    { class: "row", style: { alignItems: "flex-start" } },
                    f.group("Face", f.face(0, 1)),
                    f.group("Background", f.select(2, [[0, "Window"], [1, "Dim"], [2, "Transparent"]])),
                    f.group("Window Position", f.select(3, [[0, "Top"], [1, "Middle"], [2, "Bottom"]])),
                    f.group("Name", f.text(4, { width: 140 }))
                ),
                field("Text", ta),
                h("div", { class: "hint" }, "Escape codes: \\V[n] \\N[n] \\P[n] \\G \\C[n] \\I[n] \\{ \\} \\$ \\. \\| \\! \\> \\< \\^ \\\\"),
                preview
            ),
            noEnterOk: true
        });
        if (!ok) return undefined;
        return { params: p, text };
    }
});

// Show Choices
def(102, "Show Choices…", 1, "Message", {
    defaults: () => [["Yes", "No"], 1, 0, 2, 0],
    read: block => {
        const segs = segments(block, [402, 403, 404]);
        const branches = {};
        let cancel = null;
        for (const s of segs.slice(1)) {
            if (s.head.code === 402) branches[s.head.parameters[0]] = s.children;
            if (s.head.code === 403) cancel = s.children;
        }
        return { params: deepClone(block[0].parameters), branches, cancel };
    },
    build: (state, indent) => {
        const p = state.params;
        const lines = [line(102, indent, p)];
        p[0].forEach((choice, i) => {
            lines.push(line(402, indent, [i, choice]));
            lines.push(...childrenOr(state.branches && state.branches[i], indent));
        });
        if (p[1] === -2) {
            lines.push(line(403, indent, [6, null]));
            lines.push(...childrenOr(state.cancel, indent));
        }
        lines.push(line(404, indent));
        return lines;
    },
    edit: async (ctx, state) => {
        const p = deepClone(state.params);
        while (p.length < 5) p.push(p.length === 2 ? 0 : p.length === 3 ? 2 : 0);
        const choices = p[0].concat(["", "", "", "", "", ""]).slice(0, 6);
        const f = new Form(ctx, p);
        const inputs = choices.map((c, i) => field("#" + (i + 1), textInput(c, v => (choices[i] = v), { width: 220 })));
        const cancelOptions = () => [[-2, "Branch"], [-1, "Disallow"], ...choices.map((c, i) => [i, "Choice #" + (i + 1)]).filter(([i]) => choices[i])];
        const ok = await openDialog({
            title: "Show Choices",
            id: "cmd-show-choices",
            body: h(
                "div",
                { class: "row", style: { alignItems: "flex-start" } },
                f.group("Choices", h("div", { class: "grid-2" }, ...inputs)),
                h(
                    "div",
                    { class: "col" },
                    f.group("Background", f.select(4, [[0, "Window"], [1, "Dim"], [2, "Transparent"]])),
                    f.group("Window Position", f.select(3, [[0, "Left"], [1, "Middle"], [2, "Right"]])),
                    f.group("Default", f.select(2, [[-1, "None"], [0, "Choice #1"], [1, "Choice #2"], [2, "Choice #3"], [3, "Choice #4"], [4, "Choice #5"], [5, "Choice #6"]])),
                    f.group("Cancel", f.select(1, cancelOptions()))
                )
            )
        });
        if (!ok) return undefined;
        // Remove trailing empty choices but keep inner ones.
        let n = 6;
        while (n > 1 && !choices[n - 1]) n--;
        p[0] = choices.slice(0, n);
        if (p[1] >= n) p[1] = -1;
        if (p[2] >= n) p[2] = 0;
        return { ...state, params: p };
    }
});

simple(103, "Input Number…", 1, "Message", [1, 1], (f) => [
    f.labeled("Variable", f.variablePick(0)),
    f.labeled("Digits", f.num(1, { min: 1, max: 8 }))
]);

simple(104, "Select Item…", 1, "Message", [1, 2], (f) => [
    f.labeled("Variable", f.variablePick(0)),
    f.labeled("Item Type", f.select(1, [[1, "Regular Item"], [2, "Key Item"], [3, "Hidden Item A"], [4, "Hidden Item B"]]))
]);

// Scrolling text
def(105, "Show Scrolling Text…", 1, "Message", {
    defaults: () => [2, false],
    read: block => ({ params: deepClone(block[0].parameters), text: block.filter(l => l.code === 405).map(l => l.parameters[0]).join("\n") }),
    build: (state, indent) => [line(105, indent, state.params), ...state.text.split("\n").map(t => line(405, indent, [t]))],
    edit: async (ctx, state) => {
        const p = deepClone(state.params);
        let text = state.text || "";
        const f = new Form(ctx, p);
        const ok = await openDialog({
            title: "Show Scrolling Text",
            body: h("div", { class: "col" }, field("Text", textArea(text, v => (text = v), { rows: 12, width: 520 })), h("div", { class: "row center" }, f.labeled("Speed", f.num(0, { min: 1, max: 8 })), f.check(1, "No Fast Forward"))),
            noEnterOk: true
        });
        return ok ? { params: p, text } : undefined;
    }
});

// Comment
def(108, "Comment…", 1, "Flow Control", {
    defaults: () => [""],
    read: block => ({ params: [], text: [block[0].parameters[0], ...block.filter(l => l.code === 408).map(l => l.parameters[0])].join("\n") }),
    build: (state, indent) => {
        const lines = state.text.split("\n");
        return [line(108, indent, [lines[0]]), ...lines.slice(1).map(t => line(408, indent, [t]))];
    },
    edit: async (ctx, state) => {
        let text = state.text || "";
        const ok = await openDialog({ title: "Comment", body: textArea(text, v => (text = v), { rows: 10, width: 520 }), noEnterOk: true });
        return ok ? { params: [], text } : undefined;
    }
});

simple(121, "Control Switches…", 1, "Game Progression", [1, 1, 0], (f, p) => {
    const store = [p[0], p[0] === p[1] ? p[0] : p[1]];
    const sub = new Form(f.ctx, [p[0]]);
    sub.onChange = () => {
        p[0] = sub.p[0];
        p[1] = sub.p[0];
    };
    const mode = [p[0] === p[1] ? 0 : 1];
    const mf = new Form(f.ctx, mode);
    const range = [store[0], store[1]];
    const rf = new Form(f.ctx, range);
    rf.onChange = () => {
        if (mode[0] === 1) {
            p[0] = Math.min(range[0], range[1]);
            p[1] = Math.max(range[0], range[1]);
        }
    };
    return [
        f.group("Switch", mf.choice(0, [
            [0, "Single", () => sub.switchPick(0)],
            [1, "Range", () => h("div", { class: "row center" }, rf.num(0, { min: 1 }), "~", rf.num(1, { min: 1 }))]
        ], {
            onSelect: v => {
                if (v === 0) p[0] = p[1] = sub.p[0];
                else rf.onChange();
            }
        })),
        f.group("Operation", f.select(2, [[0, "ON"], [1, "OFF"]]))
    ];
});

simple(122, "Control Variables…", 1, "Game Progression", [1, 1, 0, 0, 0], null);
COMMANDS.get(122).edit = editControlVariables;

simple(123, "Control Self Switch…", 1, "Game Progression", ["A", 0], f => [
    f.labeled("Self Switch", f.select(0, ["A", "B", "C", "D"])),
    f.labeled("Operation", f.select(1, [[0, "ON"], [1, "OFF"]]))
]);

simple(124, "Control Timer…", 1, "Game Progression", [0, 60], (f, p) => {
    const t = [Math.floor(p[1] / 60), p[1] % 60];
    const tf = new Form(f.ctx, t);
    tf.onChange = () => (p[1] = t[0] * 60 + t[1]);
    return [f.choice(0, [
        [0, "Start", () => h("div", { class: "row center" }, tf.num(0, { min: 0, max: 99, width: 60 }), "min", tf.num(1, { min: 0, max: 59, width: 60 }), "sec")],
        [1, "Stop"]
    ])];
});

// Conditional Branch
def(111, "Conditional Branch…", 1, "Flow Control", {
    defaults: () => [0, 1, 0],
    read: block => {
        const segs = segments(block, [411, 412]);
        const thenChildren = segs[0].children;
        const elseSeg = segs.find(s => s.head.code === 411);
        return { params: deepClone(block[0].parameters), thenChildren, elseChildren: elseSeg ? elseSeg.children : null, hasElse: !!elseSeg };
    },
    build: (state, indent) => {
        const lines = [line(111, indent, state.params), ...childrenOr(state.thenChildren, indent)];
        if (state.hasElse) lines.push(line(411, indent), ...childrenOr(state.elseChildren, indent));
        lines.push(line(412, indent));
        return lines;
    },
    edit: editConditionalBranch
});

simple(112, "Loop", 1, "Flow Control", [], null, {
    build: (state, indent) => [line(112, indent), ...childrenOr(state.children, indent), line(413, indent)],
    read: block => ({ params: [], children: segments(block, [413])[0].children })
});
simple(113, "Break Loop", 1, "Flow Control", [], null);
simple(115, "Exit Event Processing", 1, "Flow Control", [], null);
simple(117, "Common Event…", 1, "Flow Control", [1], f => [f.labeled("Common Event", f.db(0, "commonEvent"))]);
simple(118, "Label…", 1, "Flow Control", [""], f => [f.labeled("Label Name", f.text(0, { width: 240 }))]);
simple(119, "Jump to Label…", 1, "Flow Control", [""], f => [f.labeled("Label Name", f.text(0, { width: 240 }))]);

simple(125, "Change Gold…", 1, "Party", [0, 0, 0], f => [
    f.group("Operation", f.select(0, [[0, "Increase"], [1, "Decrease"]])),
    f.group("Operand", f.operand(1, 2, { min: 0 }))
]);
simple(126, "Change Items…", 1, "Party", [1, 0, 0, 1], f => [
    f.labeled("Item", f.db(0, "item")),
    f.group("Operation", f.select(1, [[0, "Increase"], [1, "Decrease"]])),
    f.group("Operand", f.operand(2, 3, { min: 0 }))
]);
simple(127, "Change Weapons…", 1, "Party", [1, 0, 0, 1, false], f => [
    f.labeled("Weapon", f.db(0, "weapon")),
    f.group("Operation", f.select(1, [[0, "Increase"], [1, "Decrease"]])),
    f.group("Operand", f.operand(2, 3, { min: 0 })),
    f.check(4, "Include Equipment")
]);
simple(128, "Change Armors…", 1, "Party", [1, 0, 0, 1, false], f => [
    f.labeled("Armor", f.db(0, "armor")),
    f.group("Operation", f.select(1, [[0, "Increase"], [1, "Decrease"]])),
    f.group("Operand", f.operand(2, 3, { min: 0 })),
    f.check(4, "Include Equipment")
]);
simple(129, "Change Party Member…", 1, "Party", [1, 0, false], f => [
    f.labeled("Actor", f.db(0, "actor")),
    f.group("Operation", f.select(1, [[0, "Add"], [1, "Remove"]])),
    f.check(2, "Initialize")
]);

const actorOp = (code, name, extra) =>
    simple(code, name, 1, "Actor", extra.defaults, f => [
        f.group("Actor", f.actorTarget(0, 1)),
        f.group("Operation", f.select(2, [[0, "Increase"], [1, "Decrease"]])),
        f.group("Operand", f.operand(3, 4, { min: 0 })),
        extra.check ? f.check(5, extra.check) : null
    ]);
actorOp(311, "Change HP…", { defaults: [0, 0, 0, 0, 1, false], check: "Allow Knockout" });
actorOp(312, "Change MP…", { defaults: [0, 0, 0, 0, 1] });
actorOp(326, "Change TP…", { defaults: [0, 0, 0, 0, 1] });
simple(313, "Change State…", 1, "Actor", [0, 0, 0, 1], f => [
    f.group("Actor", f.actorTarget(0, 1)),
    f.group("Operation", f.select(2, [[0, "Add"], [1, "Remove"]])),
    f.labeled("State", f.db(3, "state"))
]);
simple(314, "Recover All…", 1, "Actor", [0, 0], f => [f.group("Actor", f.actorTarget(0, 1))]);
actorOp(315, "Change EXP…", { defaults: [0, 0, 0, 0, 1, false], check: "Show Level Up" });
actorOp(316, "Change Level…", { defaults: [0, 0, 0, 0, 1, false], check: "Show Level Up" });
simple(317, "Change Parameter…", 1, "Actor", [0, 1, 0, 0, 0, 1], f => [
    f.group("Actor", f.actorTarget(0, 1)),
    f.labeled("Parameter", f.select(2, [[0, "Max HP"], [1, "Max MP"], [2, "Attack"], [3, "Defense"], [4, "M.Attack"], [5, "M.Defense"], [6, "Agility"], [7, "Luck"]])),
    f.group("Operation", f.select(3, [[0, "Increase"], [1, "Decrease"]])),
    f.group("Operand", f.operand(4, 5, { min: 0 }))
]);
simple(318, "Change Skill…", 1, "Actor", [0, 1, 0, 1], f => [
    f.group("Actor", f.actorTarget(0, 1)),
    f.group("Operation", f.select(2, [[0, "Learn"], [1, "Forget"]])),
    f.labeled("Skill", f.db(3, "skill"))
]);
def(319, "Change Equipment…", 1, "Actor", {
    defaults: () => [1, 1, 0],
    edit: (ctx, state) =>
        formDialog(ctx, "Change Equipment", state, (f, p) => {
            const etypes = ctx.store.system.equipTypes.map((n, i) => [i, n]).slice(1);
            const itemBox = h("div");
            const renderItem = () => {
                itemBox.innerHTML = "";
                itemBox.appendChild(f.db(2, p[1] === 1 ? "weapon" : "armor", { allowNone: true }));
            };
            renderItem();
            return [
                f.labeled("Actor", f.db(0, "actor")),
                f.labeled("Equipment Type", f.select(1, etypes, {
                    onChange: () => {
                        p[2] = 0;
                        renderItem();
                    }
                })),
                f.labeled("Equipment", itemBox)
            ];
        })
});
simple(320, "Change Name…", 1, "Actor", [1, ""], f => [f.labeled("Actor", f.db(0, "actor")), f.labeled("Name", f.text(1, { width: 220 }))]);
simple(321, "Change Class…", 1, "Actor", [1, 1, false], f => [f.labeled("Actor", f.db(0, "actor")), f.labeled("Class", f.db(1, "class")), f.check(2, "Save Level")]);
simple(324, "Change Nickname…", 1, "Actor", [1, ""], f => [f.labeled("Actor", f.db(0, "actor")), f.labeled("Nickname", f.text(1, { width: 220 }))]);
simple(325, "Change Profile…", 1, "Actor", [1, ""], f => [f.labeled("Actor", f.db(0, "actor")), field("Profile", f.textarea(1, { rows: 3, width: 420 }))]);

//=============================================================================
// Tab 2: Movement, Character, Picture, Timing, Screen, Audio & Video

simple(201, "Transfer Player…", 2, "Movement", [0, 1, 0, 0, 0, 0], f => [
    f.group("Location", f.position(0, 1, 2, 3)),
    f.row(f.labeled("Direction", f.select(4, DIRECTIONS)), f.labeled("Fade", f.select(5, [[0, "Black"], [1, "White"], [2, "None"]])))
], { width: 460 });
simple(202, "Set Vehicle Location…", 2, "Movement", [0, 0, 1, 0, 0], f => [
    f.labeled("Vehicle", f.select(0, [[0, "Boat"], [1, "Ship"], [2, "Airship"]])),
    f.group("Location", f.position(1, 2, 3, 4))
], { width: 460 });
simple(203, "Set Event Location…", 2, "Movement", [0, 0, 0, 0, 0], (f, p) => {
    const direct = [p[1] === 0 ? p[2] : 0, p[1] === 0 ? p[3] : 0];
    const vars = [p[1] === 1 ? p[2] : 1, p[1] === 1 ? p[3] : 1];
    const ex = [p[1] === 2 ? p[2] : -1];
    const df = new Form(f.ctx, direct), vf = new Form(f.ctx, vars), ef = new Form(f.ctx, ex);
    const apply = () => {
        if (p[1] === 0) [p[2], p[3]] = direct;
        else if (p[1] === 1) [p[2], p[3]] = vars;
        else [p[2], p[3]] = [ex[0], 0];
    };
    df.onChange = vf.onChange = ef.onChange = apply;
    return [
        f.labeled("Event", f.charSelect(0, { player: false })),
        f.group("Location", f.choice(1, [
            [0, "Direct", () => h("div", { class: "row center" }, "X", df.num(0, { min: 0, width: 60 }), "Y", df.num(1, { min: 0, width: 60 }))],
            [1, "With Variables", () => h("div", { class: "col" }, h("div", { class: "row center" }, "X", vf.variablePick(0)), h("div", { class: "row center" }, "Y", vf.variablePick(1)))],
            [2, "Exchange with", () => ef.charSelect(0, { thisEvent: true })]
        ], { onSelect: apply })),
        f.labeled("Direction", f.select(4, DIRECTIONS))
    ];
});
simple(204, "Scroll Map…", 2, "Movement", [2, 1, 4, false], f => [
    f.labeled("Direction", f.select(0, [[2, "Down"], [4, "Left"], [6, "Right"], [8, "Up"]])),
    f.labeled("Distance", f.num(1, { min: 1, max: 100 })),
    f.labeled("Speed", f.select(2, [[1, "1: x8 Slower"], [2, "2: x4 Slower"], [3, "3: x2 Slower"], [4, "4: Normal"], [5, "5: x2 Faster"], [6, "6: x4 Faster"]])),
    f.check(3, "Wait for Completion")
]);

// Set Movement Route
def(205, "Set Movement Route…", 2, "Movement", {
    defaults: () => [-1, { list: [{ code: 0, parameters: [] }], repeat: false, skippable: false, wait: true }],
    read: block => ({ params: deepClone(block[0].parameters) }),
    build: (state, indent) => {
        const lines = [line(205, indent, state.params)];
        for (const c of state.params[1].list) if (c.code !== 0) lines.push(line(505, indent, [c]));
        return lines;
    },
    edit: async (ctx, state) => {
        const { editMoveRoute } = await import("./moveRoute.js");
        const r = await editMoveRoute(ctx, state.params[1], { characterId: state.params[0], showCharacter: true });
        return r ? { params: [r.characterId, r.route] } : undefined;
    }
});
simple(206, "Get on/off Vehicle", 2, "Movement", [], null);

simple(211, "Change Transparency…", 2, "Character", [0], f => [f.select(0, [[0, "ON"], [1, "OFF"]])]);
simple(216, "Change Player Followers…", 2, "Character", [0], f => [f.select(0, [[0, "ON"], [1, "OFF"]])]);
simple(217, "Gather Followers", 2, "Character", [], null);
simple(212, "Show Animation…", 2, "Character", [-1, 1, false], f => [
    f.labeled("Character", f.charSelect(0)),
    f.labeled("Animation", f.db(1, "animation")),
    f.check(2, "Wait for Completion")
]);
simple(213, "Show Balloon Icon…", 2, "Character", [-1, 1, false], f => [
    f.labeled("Character", f.charSelect(0)),
    f.labeled("Balloon Icon", f.select(1, BALLOONS.map((b, i) => [i + 1, b]))),
    f.check(2, "Wait for Completion")
]);
simple(214, "Erase Event", 2, "Character", [], null);

const pictureForm = (move) => (f, p) => [
    f.row(f.labeled("Number", f.num(0, { min: 1, max: 100 })), move ? null : f.labeled("Image", f.image(1, "pictures", { title: "Picture" }))),
    f.group("Position", f.labeled("Origin", f.select(2, [[0, "Upper Left"], [1, "Center"]])), f.choice(3, [
        [0, "Direct", () => {
            const d = [p[3] === 0 ? p[4] : 0, p[3] === 0 ? p[5] : 0];
            const df = new Form(f.ctx, d);
            df.onChange = () => {
                if (p[3] === 0) [p[4], p[5]] = d;
            };
            return h("div", { class: "row center" }, "X", df.num(0, { min: -9999, max: 9999, width: 70 }), "Y", df.num(1, { min: -9999, max: 9999, width: 70 }));
        }],
        [1, "Variables", () => {
            const v = [p[3] === 1 ? p[4] : 1, p[3] === 1 ? p[5] : 1];
            const vf = new Form(f.ctx, v);
            vf.onChange = () => {
                if (p[3] === 1) [p[4], p[5]] = v;
            };
            return h("div", { class: "col" }, h("div", { class: "row center" }, "X", vf.variablePick(0)), h("div", { class: "row center" }, "Y", vf.variablePick(1)));
        }]
    ], {
        onSelect: v => {
            if (v === 1) {
                p[4] = 1;
                p[5] = 1;
            } else {
                p[4] = 0;
                p[5] = 0;
            }
        }
    })),
    f.group("Scale & Blend",
        f.row(f.labeled("Width %", f.num(6, { min: -2000, max: 2000 })), f.labeled("Height %", f.num(7, { min: -2000, max: 2000 }))),
        f.row(f.labeled("Opacity", f.num(8, { min: 0, max: 255 })), f.labeled("Blend", f.select(9, BLEND.map((b, i) => [i, b]))))),
    move ? f.group("Duration", f.row(f.num(10, { min: 1, max: 999 }), "frames", f.check(11, "Wait for Completion")), f.labeled("Easing", f.select(12, EASING.map((e, i) => [i, e])))) : null
];
simple(231, "Show Picture…", 2, "Picture", [1, "", 0, 0, 0, 0, 100, 100, 255, 0], pictureForm(false), { width: 480 });
simple(232, "Move Picture…", 2, "Picture", [1, 0, 0, 0, 0, 0, 100, 100, 255, 0, 60, true, 0], pictureForm(true), { width: 480 });
simple(233, "Rotate Picture…", 2, "Picture", [1, 0], f => [f.labeled("Number", f.num(0, { min: 1, max: 100 })), f.labeled("Speed", f.num(1, { min: -90, max: 90 }))]);
simple(234, "Tint Picture…", 2, "Picture", [1, [0, 0, 0, 0], 60, true], f => [
    f.labeled("Number", f.num(0, { min: 1, max: 100 })),
    f.labeled("Color Tone", f.tone(1)),
    f.row(f.labeled("Duration", f.num(2, { min: 1, max: 999 })), "frames", f.check(3, "Wait for Completion"))
]);
simple(235, "Erase Picture…", 2, "Picture", [1], f => [f.labeled("Number", f.num(0, { min: 1, max: 100 }))]);

simple(230, "Wait…", 2, "Timing", [60], f => [f.row(f.num(0, { min: 1, max: 999 }), "frames (1/60 sec)")]);

simple(221, "Fadeout Screen", 2, "Screen", [], null);
simple(222, "Fadein Screen", 2, "Screen", [], null);
simple(223, "Tint Screen…", 2, "Screen", [[0, 0, 0, 0], 60, true], f => [
    f.labeled("Color Tone", f.tone(0)),
    f.row(f.labeled("Duration", f.num(1, { min: 1, max: 999 })), "frames", f.check(2, "Wait for Completion"))
]);
simple(224, "Flash Screen…", 2, "Screen", [[255, 255, 255, 170], 60, true], f => [
    f.labeled("Flash Color", f.color(0)),
    f.row(f.labeled("Duration", f.num(1, { min: 1, max: 999 })), "frames", f.check(2, "Wait for Completion"))
]);
simple(225, "Shake Screen…", 2, "Screen", [5, 5, 60, true], f => [
    f.row(f.labeled("Power", f.num(0, { min: 1, max: 9 })), f.labeled("Speed", f.num(1, { min: 1, max: 9 }))),
    f.row(f.labeled("Duration", f.num(2, { min: 1, max: 999 })), "frames", f.check(3, "Wait for Completion"))
]);
simple(236, "Set Weather Effect…", 2, "Screen", ["none", 5, 60, true], f => [
    f.labeled("Weather", f.select(0, [["none", "None"], ["rain", "Rain"], ["storm", "Storm"], ["snow", "Snow"]])),
    f.labeled("Power", f.num(1, { min: 1, max: 9 })),
    f.row(f.labeled("Duration", f.num(2, { min: 0, max: 999 })), "frames", f.check(3, "Wait for Completion"))
]);

const A = () => ({ name: "", volume: 90, pitch: 100, pan: 0 });
simple(241, "Play BGM…", 2, "Audio & Video", [A()], f => [f.audio(0, "bgm")]);
simple(242, "Fadeout BGM…", 2, "Audio & Video", [10], f => [f.row(f.num(0, { min: 1, max: 60 }), "seconds")]);
simple(243, "Save BGM", 2, "Audio & Video", [], null);
simple(244, "Resume BGM", 2, "Audio & Video", [], null);
simple(245, "Play BGS…", 2, "Audio & Video", [A()], f => [f.audio(0, "bgs")]);
simple(246, "Fadeout BGS…", 2, "Audio & Video", [10], f => [f.row(f.num(0, { min: 1, max: 60 }), "seconds")]);
simple(249, "Play ME…", 2, "Audio & Video", [A()], f => [f.audio(0, "me")]);
simple(250, "Play SE…", 2, "Audio & Video", [A()], f => [f.audio(0, "se")]);
simple(251, "Stop SE", 2, "Audio & Video", [], null);
simple(261, "Play Movie…", 2, "Audio & Video", [""], f => [f.labeled("Movie (in movies/)", f.text(0, { width: 220 }))]);

//=============================================================================
// Tab 3: Scene Control, System Settings, Map, Battle, Advanced

def(301, "Battle Processing…", 3, "Scene Control", {
    defaults: () => [0, 1, false, false],
    read: block => {
        const segs = segments(block, [601, 602, 603, 604]);
        const kids = code => {
            const s = segs.find(x => x.head.code === code);
            return s ? s.children : null;
        };
        return { params: deepClone(block[0].parameters), win: kids(601), escape: kids(602), lose: kids(603) };
    },
    build: (state, indent) => {
        const p = state.params;
        const lines = [line(301, indent, p)];
        if (p[2] || p[3]) {
            lines.push(line(601, indent), ...childrenOr(state.win, indent));
            if (p[2]) lines.push(line(602, indent), ...childrenOr(state.escape, indent));
            if (p[3]) lines.push(line(603, indent), ...childrenOr(state.lose, indent));
            lines.push(line(604, indent));
        }
        return lines;
    },
    edit: (ctx, state) =>
        formDialog(ctx, "Battle Processing", state, (f, p) => {
            const troop = [p[0] === 0 ? p[1] : 1], v = [p[0] === 1 ? p[1] : 1];
            const tf = new Form(ctx, troop), vf = new Form(ctx, v);
            tf.onChange = () => p[0] === 0 && (p[1] = troop[0]);
            vf.onChange = () => p[0] === 1 && (p[1] = v[0]);
            return [
                f.group("Troop", f.choice(0, [
                    [0, "Direct", () => tf.db(0, "troop")],
                    [1, "Variable", () => vf.variablePick(0)],
                    [2, "Same as Random Encounters"]
                ], { onSelect: x => (p[1] = x === 0 ? troop[0] : x === 1 ? v[0] : 0) })),
                f.check(2, "Can Escape"),
                f.check(3, "Continue when Loss")
            ];
        })
});

// Shop Processing
def(302, "Shop Processing…", 3, "Scene Control", {
    defaults: () => [0, 1, 0, 0, false],
    read: block => ({
        params: deepClone(block[0].parameters),
        goods: [block[0].parameters.slice(0, 4), ...block.filter(l => l.code === 605).map(l => deepClone(l.parameters))]
    }),
    build: (state, indent) => {
        const goods = state.goods.length ? state.goods : [[0, 1, 0, 0]];
        return [line(302, indent, [...goods[0], !!state.purchaseOnly]), ...goods.slice(1).map(g => line(605, indent, g))];
    },
    edit: async (ctx, state) => {
        const goods = deepClone(state.goods || [[0, 1, 0, 0]]);
        let purchaseOnly = !!state.params[4];
        const list = new ListBox({ columns: [220], header: ["Merchandise", "Price"], onActivate: i => editGood(i), trailingRow: "(add merchandise)" });
        list.el.style.height = "260px";
        list.el.style.width = "460px";
        const kinds = ["Items", "Weapons", "Armors"];
        const render = () =>
            list.setItems(goods.map(g => ({ cells: [(ctx.store.data[kinds[g[0]]][g[1]] || {}).name || "?", g[2] === 0 ? "Standard" : String(g[3])] })));
        const editGood = async i => {
            const g = deepClone(goods[i] || [0, 1, 0, 0]);
            const f = new Form(ctx, g);
            const itemBox = h("div");
            const renderItem = () => {
                itemBox.innerHTML = "";
                itemBox.appendChild(f.db(1, ["item", "weapon", "armor"][g[0]]));
            };
            renderItem();
            const pf = [g[3]];
            const priceForm = new Form(ctx, pf);
            priceForm.onChange = () => (g[3] = pf[0]);
            const r = await openDialog({
                title: "Merchandise",
                body: h(
                    "div",
                    { class: "col", style: { width: "360px" } },
                    f.labeled("Type", f.select(0, [[0, "Item"], [1, "Weapon"], [2, "Armor"]], {
                        onChange: () => {
                            g[1] = 1;
                            renderItem();
                        }
                    })),
                    f.labeled("Merchandise", itemBox),
                    f.group("Price", f.choice(2, [[0, "Standard"], [1, "Specify", () => priceForm.num(0, { min: 0, max: 9999999 })]]))
                ),
                leftButtons: i < goods.length ? [button("Delete", () => {
                    goods.splice(i, 1);
                    render();
                    document.querySelector('.dialog[data-dialog="Merchandise"] .dialog-title .close').click();
                })] : []
            });
            if (r) {
                if (i < goods.length) goods[i] = g;
                else goods.push(g);
                render();
            }
        };
        render();
        const ok = await openDialog({
            title: "Shop Processing",
            body: h("div", { class: "col" }, list.el, checkbox(purchaseOnly, "Purchase Only", v => (purchaseOnly = v)))
        });
        if (!ok || !goods.length) return undefined;
        return { params: [...goods[0], purchaseOnly], goods, purchaseOnly };
    }
});
simple(303, "Name Input Processing…", 3, "Scene Control", [1, 8], f => [f.labeled("Actor", f.db(0, "actor")), f.labeled("Max Characters", f.num(1, { min: 1, max: 16 }))]);
simple(351, "Open Menu Screen", 3, "Scene Control", [], null);
simple(352, "Open Save Screen", 3, "Scene Control", [], null);
simple(353, "Game Over", 3, "Scene Control", [], null);
simple(354, "Return to Title Screen", 3, "Scene Control", [], null);

simple(132, "Change Battle BGM…", 3, "System Settings", [A()], f => [f.audio(0, "bgm")]);
simple(133, "Change Victory ME…", 3, "System Settings", [A()], f => [f.audio(0, "me")]);
simple(139, "Change Defeat ME…", 3, "System Settings", [A()], f => [f.audio(0, "me")]);
simple(140, "Change Vehicle BGM…", 3, "System Settings", [0, A()], f => [f.labeled("Vehicle", f.select(0, [[0, "Boat"], [1, "Ship"], [2, "Airship"]])), f.audio(1, "bgm")]);
simple(134, "Change Save Access…", 3, "System Settings", [0], f => [f.select(0, [[0, "Disable"], [1, "Enable"]])]);
simple(135, "Change Menu Access…", 3, "System Settings", [0], f => [f.select(0, [[0, "Disable"], [1, "Enable"]])]);
simple(136, "Change Encounter…", 3, "System Settings", [0], f => [f.select(0, [[0, "Disable"], [1, "Enable"]])]);
simple(137, "Change Formation Access…", 3, "System Settings", [0], f => [f.select(0, [[0, "Disable"], [1, "Enable"]])]);
simple(138, "Change Window Color…", 3, "System Settings", [[0, 0, 0, 0]], f => [f.labeled("Color Tone", f.tone(0))]);
simple(322, "Change Actor Images…", 3, "System Settings", [1, "", 0, "", 0, ""], f => [
    f.labeled("Actor", f.db(0, "actor")),
    f.labeled("Face", f.face(3, 4)),
    f.labeled("Character", f.characterImage(1, 2)),
    f.labeled("[SV] Battler", f.image(5, "sv_actors"))
]);
simple(323, "Change Vehicle Image…", 3, "System Settings", [0, "", 0], f => [
    f.labeled("Vehicle", f.select(0, [[0, "Boat"], [1, "Ship"], [2, "Airship"]])),
    f.labeled("Image", f.characterImage(1, 2))
]);

simple(281, "Change Map Name Display…", 3, "Map", [0], f => [f.select(0, [[0, "ON"], [1, "OFF"]])]);
simple(282, "Change Tileset…", 3, "Map", [1], f => [f.labeled("Tileset", f.db(0, "tileset"))]);
simple(283, "Change Battle Background…", 3, "Map", ["", ""], f => [f.labeled("Background 1", f.image(0, "battlebacks1")), f.labeled("Background 2", f.image(1, "battlebacks2"))]);
simple(284, "Change Parallax…", 3, "Map", ["", false, false, 0, 0], f => [
    f.labeled("Image", f.image(0, "parallaxes")),
    f.row(f.check(1, "Loop Horizontally"), f.labeled("Scroll", f.num(3, { min: -32, max: 32 }))),
    f.row(f.check(2, "Loop Vertically"), f.labeled("Scroll", f.num(4, { min: -32, max: 32 })))
]);
simple(285, "Get Location Info…", 3, "Map", [1, 0, 0, 0, 0], (f, p) => {
    const d = [p[2] === 0 ? p[3] : 0, p[2] === 0 ? p[4] : 0], v = [p[2] === 1 ? p[3] : 1, p[2] === 1 ? p[4] : 1], c = [p[2] === 2 ? p[3] : -1];
    const df = new Form(f.ctx, d), vf = new Form(f.ctx, v), cf = new Form(f.ctx, c);
    const apply = () => {
        if (p[2] === 0) [p[3], p[4]] = d;
        else if (p[2] === 1) [p[3], p[4]] = v;
        else [p[3], p[4]] = [c[0], 0];
    };
    df.onChange = vf.onChange = cf.onChange = apply;
    return [
        f.labeled("Variable", f.variablePick(0)),
        f.labeled("Info Type", f.select(1, [[0, "Terrain Tag"], [1, "Event ID"], [2, "Tile ID (Layer 1)"], [3, "Tile ID (Layer 2)"], [4, "Tile ID (Layer 3)"], [5, "Tile ID (Layer 4)"], [6, "Region ID"]])),
        f.group("Location", f.choice(2, [
            [0, "Direct", () => h("div", { class: "row center" }, "X", df.num(0, { min: 0, width: 60 }), "Y", df.num(1, { min: 0, width: 60 }))],
            [1, "With Variables", () => h("div", { class: "col" }, vf.variablePick(0), vf.variablePick(1))],
            [2, "Character", () => cf.charSelect(0)]
        ], { onSelect: apply }))
    ];
});

const enemyOp = (code, name, extra) =>
    simple(code, name, 3, "Battle", extra.defaults, f => [
        f.labeled("Enemy", f.enemySelect(0)),
        f.group("Operation", f.select(1, [[0, "Increase"], [1, "Decrease"]])),
        f.group("Operand", f.operand(2, 3, { min: 0 })),
        extra.check ? f.check(4, extra.check) : null
    ]);
enemyOp(331, "Change Enemy HP…", { defaults: [-1, 0, 0, 1, false], check: "Allow Knockout" });
enemyOp(332, "Change Enemy MP…", { defaults: [-1, 0, 0, 1] });
enemyOp(342, "Change Enemy TP…", { defaults: [-1, 0, 0, 1] });
simple(333, "Change Enemy State…", 3, "Battle", [-1, 0, 1], f => [
    f.labeled("Enemy", f.enemySelect(0)),
    f.group("Operation", f.select(1, [[0, "Add"], [1, "Remove"]])),
    f.labeled("State", f.db(2, "state"))
]);
simple(334, "Enemy Recover All…", 3, "Battle", [-1], f => [f.labeled("Enemy", f.enemySelect(0))]);
simple(335, "Enemy Appear…", 3, "Battle", [0], f => [f.labeled("Enemy", f.enemySelect(0, false))]);
simple(336, "Enemy Transform…", 3, "Battle", [0, 1], f => [f.labeled("Enemy", f.enemySelect(0, false)), f.labeled("Transform to", f.db(1, "enemy"))]);
simple(337, "Show Battle Animation…", 3, "Battle", [0, 1, false], f => [
    f.labeled("Enemy", f.enemySelect(0, false)),
    f.labeled("Animation", f.db(1, "animation")),
    f.check(2, "Target All Enemies")
]);
simple(339, "Force Action…", 3, "Battle", [0, 0, 1, -2], (f, p) => {
    const e = [p[0] === 0 ? p[1] : 0], a = [p[0] === 1 ? p[1] : 1];
    const ef = new Form(f.ctx, e), af = new Form(f.ctx, a);
    ef.onChange = () => p[0] === 0 && (p[1] = e[0]);
    af.onChange = () => p[0] === 1 && (p[1] = a[0]);
    return [
        f.group("Subject", f.choice(0, [[0, "Enemy", () => ef.enemySelect(0, false)], [1, "Actor", () => af.dbSelect(0, "actor")]], { onSelect: x => (p[1] = x === 0 ? e[0] : a[0]) })),
        f.labeled("Skill", f.db(2, "skill")),
        f.labeled("Target", f.select(3, [[-2, "Last Target"], [-1, "Random"], [0, "Index 1"], [1, "Index 2"], [2, "Index 3"], [3, "Index 4"], [4, "Index 5"], [5, "Index 6"], [6, "Index 7"], [7, "Index 8"]]))
    ];
});
simple(340, "Abort Battle", 3, "Battle", [], null);

// Script
def(355, "Script…", 3, "Advanced", {
    defaults: () => [""],
    read: block => ({ params: [], text: [block[0].parameters[0], ...block.filter(l => l.code === 655).map(l => l.parameters[0])].join("\n") }),
    build: (state, indent) => {
        const lines = state.text.split("\n");
        return [line(355, indent, [lines[0]]), ...lines.slice(1).map(t => line(655, indent, [t]))];
    },
    edit: async (ctx, state) => {
        let text = state.text || "";
        const ta = textArea(text, v => (text = v), { rows: 16, width: 640 });
        ta.addEventListener("keydown", e => {
            if (e.key === "Tab") {
                e.preventDefault();
                const s = ta.selectionStart;
                ta.value = ta.value.slice(0, s) + "    " + ta.value.slice(ta.selectionEnd);
                ta.selectionStart = ta.selectionEnd = s + 4;
                text = ta.value;
            }
        });
        const ok = await openDialog({ title: "Script", body: ta, noEnterOk: true });
        return ok ? { params: [], text } : undefined;
    }
});

// Plugin Command (MZ)
def(357, "Plugin Command…", 3, "Advanced", {
    defaults: () => ["", "", "", {}],
    read: block => ({ params: deepClone(block[0].parameters) }),
    build: (state, indent) => {
        const lines = [line(357, indent, state.params)];
        for (const [k, v] of Object.entries(state.params[3] || {})) lines.push(line(657, indent, [k + " = " + v]));
        return lines;
    },
    edit: async (ctx, state) => {
        const { editPluginCommand } = await import("../plugins/pluginCommandDialog.js");
        const p = await editPluginCommand(ctx, state.params);
        return p ? { params: p } : undefined;
    }
});
simple(356, "Plugin Command (MV)…", 3, "Advanced", [""], f => [f.labeled("Command", f.text(0, { width: 360 }))]);

//=============================================================================
// Complex dialogs

async function editControlVariables(ctx, state) {
    const p = deepClone(state.params);
    while (p.length < 7) p.push(0);
    const f = new Form(ctx, p);
    // Target: single or range
    const single = [p[0]];
    const range = [p[0], p[1]];
    const mode = [p[0] === p[1] ? 0 : 1];
    const sf = new Form(ctx, single), rf = new Form(ctx, range), mf = new Form(ctx, mode);
    sf.onChange = () => mode[0] === 0 && (p[0] = p[1] = single[0]);
    rf.onChange = () => {
        if (mode[0] === 1) {
            p[0] = Math.min(range[0], range[1]);
            p[1] = Math.max(range[0], range[1]);
        }
    };
    // Operands keep their own storage until OK.
    const op = {
        0: [p[3] === 0 ? p[4] : 0],
        1: [p[3] === 1 ? p[4] : 1],
        2: [p[3] === 2 ? p[4] : 0, p[3] === 2 ? p[5] : 100],
        3: [p[3] === 3 ? p[4] : 0, p[3] === 3 ? p[5] : 1, p[3] === 3 ? p[6] : 0],
        4: [p[3] === 4 ? p[4] : ""]
    };
    const forms = Object.fromEntries(Object.entries(op).map(([k, v]) => [k, new Form(ctx, v)]));
    const gameDataLabel = () => {
        const { gameDataText } = ctx.__format || {};
        return gameDataText ? gameDataText(ctx, op[3][0], op[3][1], op[3][2]) : "Game Data";
    };
    const { gameDataText } = await import("./format.js");
    ctx.__format = { gameDataText };
    const gdBtn = pickerButton(gameDataLabel(), async () => {
        const r = await editGameData(ctx, op[3].slice());
        if (r) {
            op[3].splice(0, 3, ...r);
            gdBtn.setText(gameDataLabel());
        }
    });
    gdBtn.style.minWidth = "260px";
    const ok = await openDialog({
        title: "Control Variables",
        id: "cmd-control-variables",
        body: h(
            "div",
            { class: "col", style: { width: "460px" } },
            f.group("Variable", mf.choice(0, [
                [0, "Single", () => sf.variablePick(0)],
                [1, "Range", () => h("div", { class: "row center" }, rf.num(0, { min: 1 }), "~", rf.num(1, { min: 1 }))]
            ], { onSelect: v => (v === 0 ? sf.onChange() : rf.onChange()) })),
            f.group("Operation", f.select(2, [[0, "Set"], [1, "Add"], [2, "Sub"], [3, "Mul"], [4, "Div"], [5, "Mod"]])),
            f.group("Operand", f.choice(3, [
                [0, "Constant", () => forms[0].num(0, { min: -99999999, max: 99999999, width: 120 })],
                [1, "Variable", () => forms[1].variablePick(0)],
                [2, "Random", () => h("div", { class: "row center" }, forms[2].num(0, { min: -99999999, max: 99999999, width: 90 }), "~", forms[2].num(1, { min: -99999999, max: 99999999, width: 90 }))],
                [3, "Game Data", () => gdBtn],
                [4, "Script", () => forms[4].text(0, { width: 260 })]
            ]))
        )
    });
    if (!ok) return undefined;
    const t = p[3];
    const o = op[t];
    p.length = 4;
    if (t === 2) p.push(Math.min(o[0], o[1]), Math.max(o[0], o[1]));
    else p.push(...o);
    if (mode[0] === 0) p[0] = p[1] = single[0];
    return { params: p };
}

async function editGameData(ctx, gd) {
    const [type, a, b] = gd;
    const p = [type, a, b];
    const f = new Form(ctx, p);
    const store = ctx.store;
    const box = h("div", { class: "col" });
    const sub = new Form(ctx, p);
    const render = () => {
        box.innerHTML = "";
        const t = p[0];
        if (t === 0) box.appendChild(sub.db(1, "item"));
        else if (t === 1) box.appendChild(sub.db(1, "weapon"));
        else if (t === 2) box.appendChild(sub.db(1, "armor"));
        else if (t === 3) {
            box.appendChild(sub.dbSelect(1, "actor"));
            box.appendChild(sub.select(2, ["Level", "EXP", "HP", "MP", "Max HP", "Max MP", "Attack", "Defense", "M.Attack", "M.Defense", "Agility", "Luck", "TP"].map((n, i) => [i, n])));
        } else if (t === 4) {
            box.appendChild(sub.enemySelect(1, false));
            box.appendChild(sub.select(2, ["HP", "MP", "Max HP", "Max MP", "Attack", "Defense", "M.Attack", "M.Defense", "Agility", "Luck", "TP"].map((n, i) => [i, n])));
        } else if (t === 5) {
            box.appendChild(sub.charSelect(1));
            box.appendChild(sub.select(2, ["Map X", "Map Y", "Direction", "Screen X", "Screen Y"].map((n, i) => [i, n])));
        } else if (t === 6) box.appendChild(sub.select(1, [0, 1, 2, 3, 4, 5, 6, 7].map(i => [i, "Member #" + (i + 1)])));
        else if (t === 7) box.appendChild(sub.select(1, ["Map ID", "Party Members", "Gold", "Steps", "Play Time", "Timer", "Save Count", "Battle Count", "Win Count", "Escape Count"].map((n, i) => [i, n])));
        else if (t === 8) box.appendChild(sub.select(1, ["Last Used Skill ID", "Last Used Item ID", "Last Actor ID to Act", "Last Enemy Index to Act", "Last Target Actor ID", "Last Target Enemy Index"].map((n, i) => [i, n])));
    };
    const typeSelect = f.select(0, [[0, "Item"], [1, "Weapon"], [2, "Armor"], [3, "Actor"], [4, "Enemy"], [5, "Character"], [6, "Party"], [7, "Other"], [8, "Last"]], {
        onChange: () => {
            p[1] = p[0] === 3 || p[0] <= 2 ? 1 : p[0] === 5 ? -1 : 0;
            p[2] = 0;
            render();
        }
    });
    render();
    void store;
    const ok = await openDialog({ title: "Game Data", body: h("div", { class: "col", style: { width: "340px" } }, typeSelect, box) });
    return ok ? p : undefined;
}

async function editConditionalBranch(ctx, state) {
    const p = deepClone(state.params);
    let hasElse = !!state.hasElse;
    const type = [p[0]];
    // Per-type storage so switching tabs keeps values.
    const s = {
        0: p[0] === 0 ? p.slice(1) : [1, 0],
        1: p[0] === 1 ? p.slice(1) : [1, 0, 0, 0],
        2: p[0] === 2 ? p.slice(1) : ["A", 0],
        3: p[0] === 3 ? p.slice(1) : [0, 0],
        4: p[0] === 4 ? p.slice(1) : [1, 0, ""],
        5: p[0] === 5 ? p.slice(1) : [0, 0, 1],
        6: p[0] === 6 ? p.slice(1) : [-1, 2],
        7: p[0] === 7 ? p.slice(1) : [0, 0],
        8: p[0] === 8 ? p.slice(1) : [1],
        9: p[0] === 9 ? p.slice(1) : [1, false],
        10: p[0] === 10 ? p.slice(1) : [1, false],
        11: p[0] === 11 ? p.slice(1) : ["ok", 0],
        12: p[0] === 12 ? p.slice(1) : [""],
        13: p[0] === 13 ? p.slice(1) : [0]
    };
    const F = k => new Form(ctx, s[k]);
    const tf = new Form(ctx, type);
    const sw = F(0), va = F(1), ss = F(2), ti = F(3), ac = F(4), en = F(5), ch = F(6), go = F(7), it = F(8), we = F(9), ar = F(10), bu = F(11), sc = F(12), ve = F(13);
    // Variable rhs operand
    const vRhs = [s[1][1] === 0 ? s[1][2] : 0, s[1][1] === 1 ? s[1][2] : 1];
    const vrf = new Form(ctx, vRhs);
    vrf.onChange = () => (s[1][2] = vRhs[s[1][1]]);
    const timer = [Math.floor(s[3][0] / 60), s[3][0] % 60];
    const timerForm = new Form(ctx, timer);
    timerForm.onChange = () => (s[3][0] = timer[0] * 60 + timer[1]);
    // Actor sub-condition values kept per type
    const actorParam = { 1: s[4][1] === 1 ? s[4][2] : "", 2: s[4][1] === 2 ? s[4][2] : 1, 3: s[4][1] === 3 ? s[4][2] : 1, 4: s[4][1] === 4 ? s[4][2] : 1, 5: s[4][1] === 5 ? s[4][2] : 1, 6: s[4][1] === 6 ? s[4][2] : 1 };
    const apStore = { 1: [actorParam[1]], 2: [actorParam[2]], 3: [actorParam[3]], 4: [actorParam[4]], 5: [actorParam[5]], 6: [actorParam[6]] };
    const apForms = Object.fromEntries(Object.entries(apStore).map(([k, v]) => {
        const form = new Form(ctx, v);
        form.onChange = () => s[4][1] === Number(k) && (s[4][2] = v[0]);
        return [k, form];
    }));

    const tabs = [
        ["1", [
            [0, "Switch", () => h("div", { class: "row center" }, sw.switchPick(0), "is", sw.select(1, [[0, "ON"], [1, "OFF"]]))],
            [1, "Variable", () => h("div", { class: "col" },
                h("div", { class: "row center" }, va.variablePick(0), va.select(3, [[0, "="], [1, "≥"], [2, "≤"], [3, ">"], [4, "<"], [5, "≠"]])),
                va.choice(1, [[0, "Constant", () => vrf.num(0, { min: -99999999, max: 99999999, width: 110 })], [1, "Variable", () => vrf.variablePick(1)]], { labelWidth: "90px", onSelect: v => (s[1][2] = vRhs[v]) }))],
            [2, "Self Switch", () => h("div", { class: "row center" }, ss.select(0, ["A", "B", "C", "D"]), "is", ss.select(1, [[0, "ON"], [1, "OFF"]]))],
            [3, "Timer", () => h("div", { class: "row center" }, ti.select(1, [[0, "≥"], [1, "≤"]]), timerForm.num(0, { min: 0, max: 99, width: 55 }), "min", timerForm.num(1, { min: 0, max: 59, width: 55 }), "sec")]
        ]],
        ["2", [
            [4, "Actor", () => h("div", { class: "col" }, ac.dbSelect(0, "actor"), ac.choice(1, [
                [0, "In the Party"],
                [1, "Name", () => apForms[1].text(0, { width: 160 })],
                [2, "Class", () => apForms[2].dbSelect(0, "class")],
                [3, "Skill", () => apForms[3].dbSelect(0, "skill")],
                [4, "Weapon", () => apForms[4].dbSelect(0, "weapon")],
                [5, "Armor", () => apForms[5].dbSelect(0, "armor")],
                [6, "State", () => apForms[6].dbSelect(0, "state")]
            ], { labelWidth: "80px", onSelect: v => (s[4][2] = v === 0 ? 0 : apStore[v][0]) }))],
            [5, "Enemy", () => h("div", { class: "col" }, en.enemySelect(0, false), en.choice(1, [[0, "Appeared"], [1, "State", () => en.dbSelect(2, "state")]], { labelWidth: "80px" }))],
            [6, "Character", () => h("div", { class: "row center" }, ch.charSelect(0), "is facing", ch.select(1, [[2, "Down"], [4, "Left"], [6, "Right"], [8, "Up"]]))],
            [13, "Vehicle", () => h("div", { class: "row center" }, ve.select(0, [[0, "Boat"], [1, "Ship"], [2, "Airship"]]), "is driven")]
        ]],
        ["3", [
            [7, "Gold", () => h("div", { class: "row center" }, go.select(1, [[0, "≥"], [1, "≤"], [2, "<"]]), go.num(0, { min: 0, max: 99999999, width: 110 }))],
            [8, "Item", () => it.dbSelect(0, "item")],
            [9, "Weapon", () => h("div", { class: "col" }, we.dbSelect(0, "weapon"), we.check(1, "Include Equipment"))],
            [10, "Armor", () => h("div", { class: "col" }, ar.dbSelect(0, "armor"), ar.check(1, "Include Equipment"))]
        ]],
        ["4", [
            [11, "Button", () => h("div", { class: "row center" }, bu.select(0, [["ok", "OK"], ["cancel", "Cancel"], ["shift", "Shift"], ["down", "Down"], ["left", "Left"], ["right", "Right"], ["up", "Up"], ["pageup", "Pageup"], ["pagedown", "Pagedown"]]), "is", bu.select(1, [[0, "Pressed Down"], [1, "Triggered"], [2, "Repeated"]]))],
            [12, "Script", () => sc.text(0, { width: 320 })]
        ]]
    ];
    // All four pages share one radio group so only one condition is chosen.
    const pages = tabs.map(([label, choices]) => ({ label, el: tf.choice(0, choices, { labelWidth: "100px" }) }));
    // Make radios across pages exclusive by using the same name.
    const groupName = "cond" + Math.random().toString(36).slice(2);
    pages.forEach(pg => pg.el.querySelectorAll("input[type=radio]").forEach(r => {
        if (r.closest(".row") && r.parentElement.parentElement.parentElement === pg.el) r.name = groupName;
    }));
    const content = h("div", { style: { minHeight: "240px", minWidth: "520px" } });
    const bar = h("div", { class: "tabbar" });
    const show = i => {
        content.innerHTML = "";
        content.appendChild(pages[i].el);
        [...bar.children].forEach((t, k) => t.classList.toggle("active", k === i));
        // Re-sync radio states with the current type.
        pages.forEach(pg => pg.el.querySelectorAll("input[type=radio][name='" + groupName + "']").forEach(r => (r.checked = Number(r.value) === type[0])));
    };
    pages.forEach((pg, i) => {
        const t = h("div", { class: "tab" }, pg.label);
        t.addEventListener("mousedown", () => show(i));
        bar.appendChild(t);
    });
    const initialPage = tabs.findIndex(([, choices]) => choices.some(c => c[0] === p[0]));
    show(Math.max(0, initialPage));
    // Enable/disable controls for all pages whenever the type changes.
    const syncEnabled = () => {
        pages.forEach(pg => {
            pg.el.querySelectorAll(":scope > .row").forEach(row => {
                const radio = row.querySelector("input[type=radio]");
                const on = radio && Number(radio.value) === type[0];
                row.querySelectorAll("input:not([type=radio]), select, button, textarea").forEach(el => (el.disabled = !on));
            });
        });
    };
    tf.onChange = syncEnabled;
    setTimeout(syncEnabled, 0);
    const ok = await openDialog({
        title: "Conditional Branch",
        id: "cmd-conditional-branch",
        body: h("div", { class: "col" }, bar, content, checkbox(hasElse, "Create Else Branch", v => (hasElse = v)))
    });
    if (!ok) return undefined;
    const t = type[0];
    const params = [t, ...s[t]];
    if (t === 4 && params[2] === 0) params[3] = 0;
    return { ...state, params, hasElse };
}

//-----------------------------------------------------------------------------
// Palette layout (MZ order)

export const PALETTE = {
    1: ["Message", "Game Progression", "Flow Control", "Party", "Actor"],
    2: ["Movement", "Character", "Picture", "Timing", "Screen", "Audio & Video"],
    3: ["Scene Control", "System Settings", "Map", "Battle", "Advanced"]
};

export const PALETTE_ORDER = {
    Message: [101, 102, 103, 104, 105],
    "Game Progression": [121, 122, 123, 124],
    "Flow Control": [111, 112, 113, 115, 117, 118, 119, 108],
    Party: [125, 126, 127, 128, 129],
    Actor: [311, 312, 326, 313, 314, 315, 316, 317, 318, 319, 320, 321, 324, 325],
    Movement: [201, 202, 203, 204, 205, 206],
    Character: [211, 216, 217, 212, 213, 214],
    Picture: [231, 232, 233, 234, 235],
    Timing: [230],
    Screen: [221, 222, 223, 224, 225, 236],
    "Audio & Video": [241, 242, 243, 244, 245, 246, 249, 250, 251, 261],
    "Scene Control": [301, 302, 303, 351, 352, 353, 354],
    "System Settings": [132, 133, 139, 140, 134, 135, 136, 137, 138, 322, 323],
    Map: [281, 282, 283, 284, 285],
    Battle: [331, 332, 342, 333, 334, 335, 336, 337, 339, 340],
    Advanced: [355, 357, 356]
};

// Creates the initial edit state for a new command.
export function initialState(code) {
    const d = COMMANDS.get(code);
    const params = d.defaults ? d.defaults() : [];
    const state = { params };
    if (code === 101) state.text = "";
    if (code === 105 || code === 108 || code === 355) state.text = "";
    if (code === 302) state.goods = [[0, 1, 0, 0]];
    return state;
}

// Builds list lines for a command state.
export function buildLines(code, state, indent) {
    const d = COMMANDS.get(code);
    if (d.build) return d.build(state, indent);
    return [line(code, indent, state.params)];
}

// Reads an existing block (array of lines starting with the command).
export function readState(block) {
    const d = COMMANDS.get(block[0].code);
    if (d && d.read) return d.read(block);
    // Blocks with children but without a custom reader keep them.
    return { params: deepClone(block[0].parameters), children: block.slice(1) };
}

export function isEditable(code) {
    const d = COMMANDS.get(code);
    return !!(d && d.edit);
}

export { databasePicker, numberInput, selectInput, reindent };
