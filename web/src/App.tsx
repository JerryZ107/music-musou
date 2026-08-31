import { useMemo, useState, type ReactNode } from "react";
import { useLandscapeMode } from "./hooks/useLandscapeMode";
import { useLayoutShell } from "./hooks/useLayoutShell";
import {
  clearSlot,
  getAccount,
  getLastAccountName,
  listAccounts,
  newSlotDraft,
  recordRun,
  upsertAccount,
  writeSlot,
  type AccountData,
  type SlotData,
} from "./game/save";
import type { TrackId, WeaponId } from "./game/types";
import { AccountGate, SelectScreen, SlotPicker } from "./ui/screens";
import { GameScreen } from "./ui/GameScreen";
import { LandscapeModeToggle } from "./ui/LandscapeModeToggle";

type Phase = "account" | "slots" | "select" | "game";

function isTouchDevice(): boolean {
  if (new URLSearchParams(window.location.search).get("touch") === "1") return true;
  return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
}

function MenuShell(props: {
  touch: boolean;
  portrait: boolean;
  landscapeForced: boolean;
  onEnableLandscape: () => void;
  onDisableLandscape: () => void;
  children: ReactNode;
}) {
  return (
    <div className="app-menu">
      {props.touch && props.portrait && !props.landscapeForced && (
        <LandscapeModeToggle
          active={props.landscapeForced}
          portrait={props.portrait}
          variant="bar"
          onEnable={props.onEnableLandscape}
          onDisable={props.onDisableLandscape}
        />
      )}
      {props.children}
      {props.touch && (props.portrait || props.landscapeForced) && (
        <LandscapeModeToggle
          active={props.landscapeForced}
          portrait={props.portrait}
          variant="chip"
          onEnable={props.onEnableLandscape}
          onDisable={props.onDisableLandscape}
        />
      )}
    </div>
  );
}

export function App() {
  const [phase, setPhase] = useState<Phase>("account");
  const [accountName, setAccountName] = useState<string | null>(getLastAccountName());
  const [accounts, setAccounts] = useState(() => listAccounts());
  const [slotIndex, setSlotIndex] = useState(0);
  const [draft, setDraft] = useState<SlotData>(() => newSlotDraft());
  const [touch] = useState(isTouchDevice);
  const { portrait, forced, effectiveLandscape, enable, disable } = useLandscapeMode();
  const layoutPhase = phase === "game" ? "game" : "menu";
  useLayoutShell({
    touch,
    portrait,
    landscapeReady: phase === "game" ? effectiveLandscape : true,
    phase: layoutPhase,
  });

  const account: AccountData | null = useMemo(() => {
    if (!accountName) return null;
    return getAccount(accountName);
  }, [accountName, accounts, phase]);

  const enterAccount = (name: string) => {
    const acc = upsertAccount(name);
    setAccountName(acc.name);
    setAccounts(listAccounts());
    setPhase("slots");
  };

  const pickSlot = (index: number, existing: SlotData | null) => {
    setSlotIndex(index);
    setDraft(existing ?? newSlotDraft());
    setPhase("select");
  };

  const startGame = () => {
    if (!accountName) return;
    writeSlot(accountName, slotIndex, draft);
    setAccounts(listAccounts());
    setPhase("game");
  };

  const toggleWeapon = (id: WeaponId) => {
    setDraft((d) => {
      const has = d.weaponIds.includes(id);
      const weaponIds: WeaponId[] = has
        ? d.weaponIds.filter((w) => w !== id)
        : [...d.weaponIds, id].sort((a, b) => a - b);
      if (weaponIds.length === 0) return d;
      const lastWeaponId = weaponIds.includes(d.lastWeaponId) ? d.lastWeaponId : weaponIds[0]!;
      return { ...d, weaponIds, lastWeaponId };
    });
  };

  const menuProps = {
    touch,
    portrait,
    landscapeForced: forced,
    onEnableLandscape: enable,
    onDisableLandscape: disable,
  };

  if (phase === "account") {
    return (
      <MenuShell {...menuProps}>
        <AccountGate accounts={accounts} lastName={accountName} onEnter={enterAccount} />
      </MenuShell>
    );
  }

  if (phase === "slots") {
    if (!account) {
      return (
        <MenuShell {...menuProps}>
          <AccountGate accounts={accounts} lastName={accountName} onEnter={enterAccount} />
        </MenuShell>
      );
    }
    return (
      <MenuShell {...menuProps}>
        <SlotPicker
          account={account}
          onBack={() => setPhase("account")}
          onPick={pickSlot}
          onClear={(i) => {
            clearSlot(account.name, i);
            setAccounts(listAccounts());
          }}
        />
      </MenuShell>
    );
  }

  if (phase === "select") {
    return (
      <MenuShell {...menuProps}>
        <SelectScreen
          trackId={draft.trackId}
          weaponIds={draft.weaponIds}
          onTrack={(id: TrackId) => setDraft((d) => ({ ...d, trackId: id }))}
          onToggleWeapon={toggleWeapon}
          onStart={startGame}
          onBack={() => setPhase("slots")}
        />
      </MenuShell>
    );
  }

  if (phase === "game" && accountName) {
    return (
      <GameScreen
        trackId={draft.trackId}
        weaponIds={draft.weaponIds}
        weaponId={draft.lastWeaponId}
        latencyMs={draft.audioLatencyMs}
        muted={draft.muted}
        touch={touch}
        portrait={portrait}
        landscapeReady={effectiveLandscape}
        landscapeForced={forced}
        onEnableLandscape={enable}
        onDisableLandscape={disable}
        tutorial
        onExitSelect={() => setPhase("select")}
        onLatencyChange={(ms) => {
          const next = { ...draft, audioLatencyMs: ms };
          setDraft(next);
          writeSlot(accountName, slotIndex, next);
        }}
        onMuteChange={(muted) => {
          const next = { ...draft, muted };
          setDraft(next);
          writeSlot(accountName, slotIndex, next);
        }}
        onWeaponChange={(id) => {
          if (!draft.weaponIds.includes(id)) return;
          const next = { ...draft, lastWeaponId: id };
          setDraft(next);
          writeSlot(accountName, slotIndex, next);
        }}
        onOutcome={(r) => {
          recordRun(accountName, slotIndex, r);
          setAccounts(listAccounts());
        }}
      />
    );
  }

  return (
    <MenuShell {...menuProps}>
      <AccountGate accounts={accounts} lastName={accountName} onEnter={enterAccount} />
    </MenuShell>
  );
}
