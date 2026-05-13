import { useEffect, useMemo, useState } from "react";
import type { MeshConfig, YRoom } from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Submission = { name: string; slots: string[] };

const NAME_KEY = (prefix: string) => `${prefix}:displayName`;

const DEFAULT_TEMPLATE =
  'The {adjective} {noun} {verb past tense} across the {place} while shouting "{exclamation}!". Then it {verb past tense} a {adjective} {noun}.';

function parseSlots(template: string): string[] {
  const out: string[] = [];
  const re = /\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template))) out.push(m[1]!);
  return out;
}

function renderStory(template: string, slots: string[]): string {
  let i = 0;
  return template.replace(/\{[^}]+\}/g, () => slots[i++] ?? "___");
}

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="mad-screen">
        <h1>mad libs</h1>
        <p className="mad-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const [name, setName] = useState(
    () => localStorage.getItem(NAME_KEY(config.storagePrefix)) ?? "",
  );
  const [draft, setDraft] = useState<string[]>([]);
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [templateDraft, setTemplateDraft] = useState("");
  const [tick, rerender] = useState(0);

  useEffect(() => {
    if (name) localStorage.setItem(NAME_KEY(config.storagePrefix), name);
  }, [name, config.storagePrefix]);

  useEffect(() => {
    const meta = room.doc.getMap<string>("meta");
    const subs = room.doc.getMap<Submission>("subs");
    const onChange = () => rerender((n) => n + 1);
    meta.observe(onChange);
    subs.observe(onChange);
    if (!meta.has("template")) meta.set("template", DEFAULT_TEMPLATE);
    if (!meta.has("phase")) meta.set("phase", "fill");
    return () => {
      meta.unobserve(onChange);
      subs.unobserve(onChange);
    };
  }, [room]);

  void tick;
  const meta = room.doc.getMap<string>("meta");
  const subs = room.doc.getMap<Submission>("subs");
  const template = meta.get("template") ?? DEFAULT_TEMPLATE;
  const phase = (meta.get("phase") as "fill" | "reveal") ?? "fill";

  const slotLabels = useMemo(() => parseSlots(template), [template]);

  const mySub = subs.get(room.peerId);
  useEffect(() => {
    setDraft((d) => {
      if (d.length !== slotLabels.length) return slotLabels.map((_, i) => d[i] ?? "");
      return d;
    });
  }, [slotLabels]);

  const submitFill = () => {
    if (!name.trim()) return;
    if (draft.length !== slotLabels.length) return;
    if (draft.some((s) => !s.trim())) return;
    subs.set(room.peerId, { name: name.trim(), slots: draft.map((s) => s.trim()) });
  };

  const unsubmit = () => subs.delete(room.peerId);

  const toReveal = () => meta.set("phase", "reveal");
  const toFill = () => meta.set("phase", "fill");

  const newRound = () => {
    room.doc.transact(() => {
      meta.set("phase", "fill");
      subs.forEach((_v, k) => subs.delete(k));
    });
    setDraft(slotLabels.map(() => ""));
  };

  const saveTemplate = () => {
    const t = templateDraft.trim();
    if (!t) return;
    room.doc.transact(() => {
      meta.set("template", t);
      meta.set("phase", "fill");
      subs.forEach((_v, k) => subs.delete(k));
    });
    setEditingTemplate(false);
    setDraft(parseSlots(t).map(() => ""));
  };

  const submissionList: Array<Submission & { peerId: string }> = [];
  subs.forEach((v, k) => submissionList.push({ ...v, peerId: k }));
  submissionList.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mad-screen">
      <header className="mad-header">
        <h1>mad libs</h1>
        <p className="mad-status">
          {submissionList.length} {submissionList.length === 1 ? "submission" : "submissions"} ·{" "}
          {room.peerCount + 1} present · phase: {phase}
        </p>
      </header>

      <section className="mad-template">
        {editingTemplate ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveTemplate();
            }}
          >
            <textarea
              value={templateDraft}
              onChange={(e) => setTemplateDraft(e.target.value)}
              rows={4}
              placeholder="enter a template with {slot} markers"
              autoFocus
            />
            <div className="mad-template-actions">
              <button type="submit">save & reset round</button>
              <button type="button" onClick={() => setEditingTemplate(false)}>
                cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="mad-template-display"
            onClick={() => {
              setTemplateDraft(template);
              setEditingTemplate(true);
            }}
          >
            <span className="mad-tpl-label">template (tap to edit)</span>
            <span className="mad-tpl-text">{template}</span>
          </button>
        )}
      </section>

      <div className="mad-name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="your name"
          maxLength={48}
          aria-label="your name"
        />
      </div>

      {phase === "fill" ? (
        <section className="mad-fill">
          <h2 className="mad-section-title">fill the slots</h2>
          {mySub ? (
            <div className="mad-submitted">
              <p>
                ✓ you submitted as <strong>{mySub.name}</strong>
              </p>
              <button type="button" onClick={unsubmit}>
                unsubmit
              </button>
            </div>
          ) : (
            <form
              className="mad-slots"
              onSubmit={(e) => {
                e.preventDefault();
                submitFill();
              }}
            >
              {slotLabels.map((label, i) => (
                <label key={i} className="mad-slot">
                  <span className="mad-slot-label">{label}</span>
                  <input
                    value={draft[i] ?? ""}
                    onChange={(e) => {
                      const next = draft.slice();
                      next[i] = e.target.value;
                      setDraft(next);
                    }}
                    placeholder={`a ${label}`}
                    maxLength={60}
                  />
                </label>
              ))}
              <button
                type="submit"
                className="mad-submit"
                disabled={
                  !name.trim() || draft.length !== slotLabels.length || draft.some((s) => !s.trim())
                }
              >
                ✓ submit blindly
              </button>
            </form>
          )}

          <div className="mad-roster">
            <h3>submitted so far</h3>
            {submissionList.length === 0 ? (
              <p className="mad-empty">nobody yet</p>
            ) : (
              <ul>
                {submissionList.map((s) => (
                  <li key={s.peerId}>{s.name}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="mad-phase-actions">
            <button
              type="button"
              className="mad-reveal-btn"
              onClick={toReveal}
              disabled={submissionList.length === 0}
            >
              reveal all stories →
            </button>
          </div>
        </section>
      ) : (
        <section className="mad-reveal">
          <h2 className="mad-section-title">stories</h2>
          {submissionList.length === 0 ? (
            <p className="mad-empty">no submissions to reveal</p>
          ) : (
            <ul className="mad-stories">
              {submissionList.map((s) => (
                <li key={s.peerId} className="mad-story">
                  <strong className="mad-story-author">{s.name}'s version</strong>
                  <p className="mad-story-text">{renderStory(template, s.slots)}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="mad-phase-actions">
            <button type="button" onClick={toFill}>
              ← back to fill
            </button>
            <button type="button" className="mad-newround-btn" onClick={newRound}>
              new round (clear all)
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
