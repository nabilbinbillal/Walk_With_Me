import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  addGhostMessage,
  isJoinTime,
  isNabilHere,
  isNoshinHere,
  nabilStatusText,
  parseProposalTime,
  pingPresence,
  readGhostMessages,
  readMessages,
  readProposals,
  removeGhostMessage,
  respondProposal,
  useStoreSubscribe,
  type Proposal,
} from "@/lib/store";

type Mode = "noshin" | "nabil";

type Props = {
  mode: Mode;
};

function NoshinSpriteSmall({
  ghost = false,
  walking = false,
}: {
  ghost?: boolean;
  walking?: boolean;
}) {
  return (
    <div
      className="font-pixel no-select"
      style={{
        width: 64,
        height: 80,
        position: "relative",
        opacity: ghost ? 0.55 : 1,
        filter: ghost ? "grayscale(0.4)" : undefined,
      }}
    >
      <svg viewBox="0 0 24 32" width="64" height="80" shapeRendering="crispEdges">
        {/* shadow */}
        {!ghost && <rect x="0" y="32" width="24" height="2" fill="rgba(0,0,0,0.25)" />}
        {/* hair */}
        <rect x="4" y="2" width="16" height="14" fill={ghost ? "#888" : "#3a1f25"} />
        <rect x="2" y="6" width="2" height="12" fill={ghost ? "#888" : "#3a1f25"} />
        <rect x="20" y="6" width="2" height="12" fill={ghost ? "#888" : "#3a1f25"} />
        {/* face */}
        <rect x="6" y="8" width="12" height="10" fill={ghost ? "#dcdcdc" : "#ffd9b8"} />
        {/* bangs */}
        <rect x="6" y="8" width="12" height="3" fill={ghost ? "#888" : "#3a1f25"} />
        {/* ribbon */}
        <rect x="2" y="0" width="6" height="4" fill={ghost ? "#bbb" : "#ff3b6e"} />
        <rect x="14" y="0" width="6" height="4" fill={ghost ? "#bbb" : "#ff3b6e"} />
        <rect x="8" y="2" width="6" height="2" fill={ghost ? "#bbb" : "#ff3b6e"} />
        <rect x="3" y="1" width="2" height="2" fill={ghost ? "#ddd" : "#ff85a8"} />
        <rect x="15" y="1" width="2" height="2" fill={ghost ? "#ddd" : "#ff85a8"} />
        {/* eyes */}
        <rect x="8" y="12" width="2" height="2" fill="#1a1a1a" />
        <rect x="14" y="12" width="2" height="2" fill="#1a1a1a" />
        <rect x="11" y="16" width="2" height="1" fill="#1a1a1a" />
        {/* dress */}
        <rect x="4" y="18" width="16" height="10" fill={ghost ? "#bbb" : "#ff7aa2"} />
        {/* arms */}
        <rect x="2" y="18" width="2" height="8" fill={ghost ? "#dcdcdc" : "#ffd9b8"} />
        <rect x="20" y="18" width="2" height="8" fill={ghost ? "#dcdcdc" : "#ffd9b8"} />
        {/* legs */}
        <rect x={walking ? "5" : "6"} y="28" width="4" height="4" fill={ghost ? "#888" : "#3a1f25"} />
        <rect x={walking ? "15" : "14"} y="28" width="4" height="4" fill={ghost ? "#888" : "#3a1f25"} />
      </svg>
    </div>
  );
}

function NabilSpriteSmall({
  ghost = false,
}: {
  ghost?: boolean;
}) {
  return (
    <div
      className={`no-select ${ghost ? "float-ghost" : ""}`}
      style={{
        width: 64,
        height: 80,
        position: "relative",
        opacity: ghost ? 0.6 : 1,
      }}
    >
      <svg viewBox="0 0 24 32" width="64" height="80" shapeRendering="crispEdges">
        {!ghost && <rect x="0" y="32" width="24" height="2" fill="rgba(0,0,0,0.25)" />}
        {/* hair */}
        <rect x="4" y="2" width="16" height="12" fill={ghost ? "#bcd2ff" : "#1a1a1a"} />
        {/* face */}
        <rect x="6" y="8" width="12" height="10" fill={ghost ? "#eaf1ff" : "#e8b894"} />
        {/* bangs */}
        <rect x="6" y="8" width="12" height="3" fill={ghost ? "#bcd2ff" : "#1a1a1a"} />
        {/* ribbon */}
        <rect x="2" y="0" width="6" height="4" fill={ghost ? "#a8c4ff" : "#4ea3ff"} />
        <rect x="14" y="0" width="6" height="4" fill={ghost ? "#a8c4ff" : "#4ea3ff"} />
        <rect x="8" y="2" width="6" height="2" fill={ghost ? "#a8c4ff" : "#4ea3ff"} />
        <rect x="3" y="1" width="2" height="2" fill={ghost ? "#dde9ff" : "#a8d4ff"} />
        <rect x="15" y="1" width="2" height="2" fill={ghost ? "#dde9ff" : "#a8d4ff"} />
        {/* eyes */}
        <rect x="8" y="12" width="2" height="2" fill={ghost ? "#5a7bc4" : "#1a1a1a"} />
        <rect x="14" y="12" width="2" height="2" fill={ghost ? "#5a7bc4" : "#1a1a1a"} />
        <rect x="11" y="16" width="2" height="1" fill={ghost ? "#5a7bc4" : "#1a1a1a"} />
        {/* shirt */}
        <rect x="4" y="18" width="16" height="8" fill={ghost ? "#bcd2ff" : "#3a5aa0"} />
        {/* arms */}
        <rect x="2" y="18" width="2" height="8" fill={ghost ? "#eaf1ff" : "#e8b894"} />
        <rect x="20" y="18" width="2" height="8" fill={ghost ? "#eaf1ff" : "#e8b894"} />
        {/* pants */}
        <rect x="6" y="26" width="4" height="6" fill={ghost ? "#bcd2ff" : "#1a1a1a"} />
        <rect x="14" y="26" width="4" height="6" fill={ghost ? "#bcd2ff" : "#1a1a1a"} />
      </svg>
    </div>
  );
}

export function Home({ mode }: Props) {
  const [, force] = useState(0);
  const [walkAloneOpen, setWalkAloneOpen] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>(readProposals());
  const [nabilHere, setNabilHere] = useState(isNabilHereSync());
  const [otherHere, setOtherHere] = useState(
    mode === "noshin" ? isNabilHereSync() : isNoshinHereSync(),
  );
  const [unread, setUnread] = useState(readMessages().length);

  useEffect(() => {
    pingPresence(mode);
    const id = window.setInterval(() => {
      pingPresence(mode);
      setNabilHere(isNabilHereSync());
      setOtherHere(mode === "noshin" ? isNabilHereSync() : isNoshinHereSync());
      force((v) => v + 1);
    }, 2000);
    return () => window.clearInterval(id);
  }, [mode]);

  useEffect(() => {
    const off = useStoreSubscribe(() => {
      setProposals(readProposals());
      setNabilHere(isNabilHereSync());
      setOtherHere(mode === "noshin" ? isNabilHereSync() : isNoshinHereSync());
      setUnread(readMessages().length);
    });
    return off;
  }, []);

  const otherName = mode === "noshin" ? "Nabil" : "Noshin";
  const meName = mode === "noshin" ? "Noshin" : "Nabil";
  const incoming = proposals.filter((p) => p.from !== mode);
  const outgoing = proposals.filter((p) => p.from === mode);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div className="scanline" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1 }} />

      {/* Header */}
      <header
        style={{
          padding: "20px 16px 12px",
          borderBottom: "3px solid #1a1a1a",
          background: "#fff",
          textAlign: "center",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div className="font-pixel" style={{ fontSize: 10, opacity: 0.6 }}>
          ★  ENDLESS WALK  ★
        </div>
        <h1
          className="font-pixel"
          style={{
            fontSize: 22,
            margin: "10px 0 6px",
            color: "#1a1a1a",
          }}
        >
          LET'S WALK NOSHIN
        </h1>
        <div className="font-mono-retro" style={{ fontSize: 22, opacity: 0.7 }}>
          {mode === "noshin" ? "noshin's room" : "nabil's room"} <span className="cursor-blink" />
        </div>
      </header>

      <main
        style={{
          flex: 1,
          padding: "20px 16px",
          maxWidth: 760,
          margin: "0 auto",
          width: "100%",
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* Presence card */}
        <section
          className="pixel-border"
          style={{
            padding: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {mode === "noshin" ? (
              nabilHere ? (
                <NabilSpriteSmall />
              ) : (
                <NabilSpriteSmall ghost />
              )
            ) : (
              <NoshinSpriteSmall walking />
            )}
            <div>
              <div className="font-pixel" style={{ fontSize: 11, marginBottom: 4 }}>
                {mode === "noshin"
                  ? nabilHere
                    ? "NABIL CAME HERE  ♡"
                    : "NABIL ISN'T HERE..."
                  : "NOSHIN IS WALKING SOMEWHERE"}
              </div>
              <div className="font-mono-retro" style={{ fontSize: 18, opacity: 0.75 }}>
                {mode === "noshin"
                  ? nabilHere
                    ? "he's right next to you, cuteee"
                    : "his little ghost is keeping you company"
                  : "she would love a walking buddy"}
              </div>
            </div>
          </div>
          <div className="font-pixel" style={{ fontSize: 9, opacity: 0.6, textAlign: "right" }}>
            {mode === "noshin" ? "/  HOME" : "/NABIL"}
          </div>
        </section>

        {/* Action buttons */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
          <button
            className="pixel-btn pixel-btn-primary"
            onClick={() => setWalkAloneOpen(true)}
            style={{ padding: "18px 12px", fontSize: 12 }}
          >
            ► WALK ALONE
          </button>
          {otherHere ? (
            <Link
              href={mode === "noshin" ? "/walk" : "/nabil/walk"}
              className="pixel-btn"
              style={{
                padding: "18px 12px",
                fontSize: 12,
                textAlign: "center",
                textDecoration: "none",
                display: "block",
              }}
            >
              {`► WALK WITH ${otherName.toUpperCase()}`}
            </Link>
          ) : (
            <button
              className="pixel-btn"
              disabled
              title={`${otherName} isn't online yet`}
              style={{
                padding: "18px 12px",
                fontSize: 12,
                opacity: 0.45,
                cursor: "not-allowed",
              }}
            >
              {`✗ ${otherName.toUpperCase()} NOT HERE`}
            </button>
          )}
        </section>

        {/* Join now banner — surfaces accepted proposals when their time arrives */}
        <JoinNowBanner
          proposals={proposals}
          mode={mode}
          otherHere={otherHere}
          otherName={otherName}
        />

        {/* Proposals */}
        <section style={{ marginBottom: 18 }}>
          <div className="font-pixel" style={{ fontSize: 12, marginBottom: 10 }}>
            ✉  WALK PROPOSALS
          </div>

          {proposals.length === 0 && (
            <div
              className="pixel-border"
              style={{ padding: 16, textAlign: "center" }}
            >
              <div className="font-mono-retro" style={{ fontSize: 18, opacity: 0.7 }}>
                no walks proposed yet... start the world to plan one ♡
              </div>
            </div>
          )}

          {incoming.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div className="font-pixel" style={{ fontSize: 9, opacity: 0.6, marginBottom: 6 }}>
                FROM {otherName.toUpperCase()}
              </div>
              {incoming.map((p) => (
                <ProposalCard
                  key={p.id}
                  p={p}
                  canRespond={!p.responded}
                  onAccept={() => respondProposal(p.id, "accepted")}
                  onDecline={() => respondProposal(p.id, "declined")}
                />
              ))}
            </div>
          )}

          {outgoing.length > 0 && (
            <div>
              <div className="font-pixel" style={{ fontSize: 9, opacity: 0.6, marginBottom: 6 }}>
                FROM YOU
              </div>
              {outgoing.map((p) => (
                <ProposalCard key={p.id} p={p} canRespond={false} />
              ))}
            </div>
          )}
        </section>

        {mode === "nabil" && <GhostMessagesPanel />}

        {/* Stats */}
        <section
          className="pixel-border"
          style={{ padding: 12, display: "flex", justifyContent: "space-between" }}
        >
          <div>
            <div className="font-pixel" style={{ fontSize: 9, opacity: 0.6 }}>MESSAGES</div>
            <div className="font-pixel" style={{ fontSize: 18 }}>{unread}</div>
          </div>
          <div>
            <div className="font-pixel" style={{ fontSize: 9, opacity: 0.6 }}>YOU ARE</div>
            <div className="font-pixel" style={{ fontSize: 14 }}>{meName.toUpperCase()}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="font-pixel" style={{ fontSize: 9, opacity: 0.6 }}>{otherName.toUpperCase()}</div>
            <div
              className="font-mono-retro"
              style={{
                fontSize: 18,
                color: nabilHere || mode === "nabil" ? "#d94e7c" : "#1a1a1a",
                lineHeight: 1.1,
                marginTop: 2,
              }}
            >
              {mode === "noshin" ? nabilStatusText() : "walking somewhere"}
            </div>
          </div>
        </section>
      </main>

      <footer
        className="font-pixel"
        style={{
          padding: "16px 12px 24px",
          textAlign: "center",
          fontSize: 9,
          borderTop: "3px dashed #1a1a1a",
          background: "#fff",
          position: "relative",
          zIndex: 2,
        }}
      >
        DEDICATED TO DEAREST NAYAMI
        <br />
        <span style={{ fontSize: 9, opacity: 0.7 }}>MADE WITH LOVE · BIDIBO ♡</span>
      </footer>

      {walkAloneOpen && (
        <WalkAloneDialog
          otherName={otherName}
          walkPath={mode === "noshin" ? "/walk" : "/nabil/walk"}
          onClose={() => setWalkAloneOpen(false)}
        />
      )}
    </div>
  );
}

function JoinNowBanner({
  proposals,
  mode,
  otherHere,
  otherName,
}: {
  proposals: Proposal[];
  mode: Mode;
  otherHere: boolean;
  otherName: string;
}) {
  const [, tick] = useState(0);
  // re-evaluate every 30s so "join now" appears as time crosses
  useEffect(() => {
    const id = window.setInterval(() => tick((v) => v + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const due = proposals.filter(isJoinTime);
  if (due.length === 0) return null;
  const p = due[0];
  const target = parseProposalTime(p.time);
  const inFuture = target ? target.getTime() - Date.now() : 0;
  const niceTime = target
    ? target.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : p.time;

  let headline: string;
  if (!target) headline = "IT'S TIME ♡";
  else if (inFuture > 60_000)
    headline = `STARTING IN ${Math.ceil(inFuture / 60_000)} MIN ♡`;
  else if (inFuture > 0) headline = "ALMOST TIME ♡";
  else headline = "IT'S TIME ♡";

  const walkPath = mode === "noshin" ? "/walk" : "/nabil/walk";

  return (
    <section
      className="pixel-border join-pulse"
      style={{
        padding: 14,
        marginBottom: 18,
        background: "#fff0f5",
        borderColor: "#d94e7c",
      }}
    >
      <div
        className="font-pixel"
        style={{ fontSize: 12, color: "#d94e7c", marginBottom: 6 }}
      >
        ♡ {headline}
      </div>
      <div
        className="font-mono-retro"
        style={{ fontSize: 20, lineHeight: 1.3, marginBottom: 4 }}
      >
        {p.message ? `"${p.message}"` : "your walk together is ready"}
      </div>
      <div
        className="font-mono-retro"
        style={{ fontSize: 16, opacity: 0.7, marginBottom: 12 }}
      >
        {niceTime} · {otherHere ? `${otherName.toLowerCase()} is here ♡` : `waiting for ${otherName.toLowerCase()}...`}
      </div>
      {otherHere ? (
        <Link
          href={walkPath}
          className="pixel-btn pixel-btn-primary"
          style={{
            display: "inline-block",
            textDecoration: "none",
            fontSize: 11,
            padding: "12px 18px",
          }}
        >
          ► JOIN NOW
        </Link>
      ) : (
        <button
          className="pixel-btn"
          disabled
          style={{
            fontSize: 11,
            padding: "12px 18px",
            opacity: 0.5,
            cursor: "not-allowed",
          }}
        >
          WAITING FOR {otherName.toUpperCase()}...
        </button>
      )}
    </section>
  );
}

function GhostMessagesPanel() {
  const [items, setItems] = useState<string[]>(readGhostMessages());
  const [text, setText] = useState("");

  useEffect(() => {
    const off = useStoreSubscribe(() => setItems(readGhostMessages()));
    return off;
  }, []);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    addGhostMessage(t);
    setText("");
  };

  return (
    <section style={{ marginBottom: 18 }}>
      <div className="font-pixel" style={{ fontSize: 12, marginBottom: 10 }}>
        ☁  GHOST WHISPERS FOR NOSHIN
      </div>
      <div className="pixel-border" style={{ padding: 14 }}>
        <div className="font-mono-retro" style={{ fontSize: 18, opacity: 0.75, marginBottom: 10 }}>
          when she walks alone, your ghost floats in the sky and says one of these to her ♡
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="say something cute..."
            className="font-mono-retro"
            maxLength={80}
            style={{
              flex: 1,
              fontSize: 18,
              padding: "8px 10px",
              border: "3px solid #1a1a1a",
              background: "#fff",
              outline: "none",
            }}
          />
          <button className="pixel-btn pixel-btn-primary" onClick={submit} style={{ fontSize: 10 }}>
            + ADD
          </button>
        </div>
        {items.length === 0 ? (
          <div className="font-mono-retro" style={{ fontSize: 16, opacity: 0.6 }}>
            no whispers yet... add one above ♡
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((m, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  border: "2px dashed #1a1a1a",
                  background: "#fafafa",
                }}
              >
                <span className="font-mono-retro" style={{ fontSize: 18, lineHeight: 1.2 }}>
                  "{m}"
                </span>
                <button
                  className="font-pixel"
                  onClick={() => removeGhostMessage(i)}
                  title="remove"
                  style={{
                    fontSize: 9,
                    padding: "4px 8px",
                    border: "2px solid #1a1a1a",
                    background: "#fff",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ProposalCard({
  p,
  canRespond,
  onAccept,
  onDecline,
}: {
  p: Proposal;
  canRespond: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
}) {
  return (
    <div className="pixel-border" style={{ padding: 12, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="font-pixel" style={{ fontSize: 11, marginBottom: 4 }}>
            ⏰ {p.time.toUpperCase()}
          </div>
          <div className="font-mono-retro" style={{ fontSize: 18, opacity: 0.8 }}>
            "{p.message}"
          </div>
        </div>
        {p.responded && (
          <div
            className="font-pixel"
            style={{
              fontSize: 9,
              padding: "4px 8px",
              background: p.responded === "accepted" ? "#ff7aa2" : "#eee",
              color: p.responded === "accepted" ? "#fff" : "#1a1a1a",
              border: "2px solid #1a1a1a",
            }}
          >
            {p.responded === "accepted" ? "♡ YES" : "× NO"}
          </div>
        )}
      </div>
      {canRespond && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button className="pixel-btn pixel-btn-primary" onClick={onAccept} style={{ fontSize: 10 }}>
            ♡ ACCEPT
          </button>
          <button className="pixel-btn" onClick={onDecline} style={{ fontSize: 10 }}>
            DECLINE
          </button>
        </div>
      )}
    </div>
  );
}

function WalkAloneDialog({
  otherName,
  walkPath,
  onClose,
}: {
  otherName: string;
  walkPath: string;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="pixel-border"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 18, maxWidth: 440, width: "100%", background: "#fff" }}
      >
        <div className="font-pixel" style={{ fontSize: 12, marginBottom: 10 }}>
          ★  ARE YOU SURE?  ★
        </div>
        <div className="font-mono-retro" style={{ fontSize: 22, lineHeight: 1.3, marginBottom: 6 }}>
          So you want to walk alone, huh?
        </div>
        <div className="font-mono-retro" style={{ fontSize: 20, lineHeight: 1.4, opacity: 0.85, marginBottom: 14 }}>
          blabla {otherName.toLowerCase()} would have come if you'd waited a little...
          <br />
          but the path is yours tonight ♡ go on, take a deep breath, and walk.
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="pixel-btn" onClick={onClose} style={{ fontSize: 11 }}>
            NEVERMIND
          </button>
          <Link
            href={walkPath}
            className="pixel-btn pixel-btn-primary"
            style={{ textDecoration: "none", display: "inline-block", fontSize: 11 }}
          >
            {"► LET'S WALK"}
          </Link>
        </div>
      </div>
    </div>
  );
}
