"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { oneVentOneLogo } from "@/shared/images";

const LoadingContext = createContext<(() => () => void) | null>(null);

export function SiteLoadingProvider({
  children,
  logo,
}: {
  children: ReactNode;
  logo: string;
}) {
  const pathname = usePathname();
  const [pending, setPending] = useState(0);
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [target, setTarget] = useState(0);
  const [progress, setProgress] = useState(0);
  const [logoFailed, setLogoFailed] = useState(false);
  const displayed = useRef(0);
  const shown = useRef(true);
  const previousPath = useRef(pathname);
  const shell = useRef<HTMLDivElement>(null);
  const register = useCallback(() => {
    setPending((count) => count + 1);
    return () => setPending((count) => Math.max(0, count - 1));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let deadline: number | undefined;
    queueMicrotask(async () => {
      if (signal.aborted) return;
      const fresh = !shown.current || previousPath.current !== pathname;
      previousPath.current = pathname;
      shown.current = true;
      setVisible(true);
      setLeaving(false);
      if (fresh) {
        displayed.current = 0;
        setProgress(0);
        setTarget(10);
      } else setTarget((value) => Math.max(value, 10));
      if (pending > 0) return;

      const images = Array.from(document.images).filter((img) => {
        if (img.closest('.hero-slide-visual[aria-hidden="true"]')) return false;
        const rect = img.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.top < window.innerHeight &&
          rect.bottom > 0
        );
      });
      let complete = 0;
      const total = images.length + 1;
      const advance = () => {
        if (signal.aborted) return;
        const next = 15 + Math.round((++complete / total) * 80);
        setTarget((value) => Math.max(value, next));
      };
      // An error also settles an image: the page can render its normal fallback.
      const jobs = images.map((img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          const settle = () => {
            img.removeEventListener("load", settle);
            img.removeEventListener("error", settle);
            resolve();
          };
          img.addEventListener("load", settle, { once: true, signal });
          img.addEventListener("error", settle, { once: true, signal });
          signal.addEventListener("abort", settle, { once: true });
        }).then(advance),
      );
      jobs.push(document.fonts.ready.then(advance, advance));
      await Promise.race([
        Promise.all(jobs),
        // Reveal usable content even if an external artwork/font host stalls.
        new Promise<void>((resolve) => {
          deadline = window.setTimeout(resolve, 8000);
        }),
      ]);
      window.clearTimeout(deadline);
      if (!signal.aborted) setTarget(100);
    });
    return () => {
      controller.abort();
      window.clearTimeout(deadline);
    };
  }, [pathname, pending]);

  useEffect(() => {
    let frame = 0;
    const from = displayed.current;
    const start = performance.now();
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : 420;
    const tick = (now: number) => {
      const elapsed = duration ? Math.min(1, (now - start) / duration) : 1;
      const next = Math.round(
        from + (target - from) * (1 - (1 - elapsed) ** 3),
      );
      displayed.current = next;
      setProgress(next);
      if (elapsed < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target]);

  useEffect(() => {
    if (progress !== 100 || target !== 100 || pending > 0) return;
    const fade = window.setTimeout(() => setLeaving(true), 160);
    const hide = window.setTimeout(() => {
      shown.current = false;
      setVisible(false);
    }, 480);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(hide);
    };
  }, [progress, target, pending]);

  useEffect(() => {
    const element = shell.current;
    if (!element) return;
    element.inert = visible;
    return () => {
      element.inert = false;
    };
  }, [visible]);

  return (
    <LoadingContext.Provider value={register}>
      <div ref={shell} className="site-shell">
        {children}
      </div>
      {visible ? (
        <div
          className={`site-loading-screen${leaving ? " is-leaving" : ""}`}
          role="status"
          aria-label="กำลังเตรียมหน้าเว็บไซต์"
        >
          <div className="site-loading-panel">
            <div className="site-loading-logo">
              <Image
                src={logoFailed ? oneVentOneLogo : logo}
                alt="โลโก้ OneVentOne"
                width={240}
                height={80}
                priority
                unoptimized
                onError={() => setLogoFailed(true)}
              />
            </div>
            <p className="site-loading-caption">ทุกคืนพิเศษ เริ่มที่นี่</p>
            <div
              className="site-loading-progress"
              role="progressbar"
              aria-label="ความคืบหน้าการเตรียมหน้าเว็บ"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="site-loading-meta">
              <span>
                {progress === 100 ? "พร้อมแล้ว" : "กำลังโหลดหน้าเว็บไซต์"}
              </span>
              <strong aria-hidden="true">{progress}%</strong>
            </div>
          </div>
        </div>
      ) : null}
      <noscript>
        <style>{".site-loading-screen{display:none!important}"}</style>
      </noscript>
    </LoadingContext.Provider>
  );
}

export function RouteLoading() {
  const register = useContext(LoadingContext);
  useEffect(() => register?.(), [register]);
  return (
    <p className="route-loading-placeholder" role="status">
      กำลังโหลดหน้าเว็บไซต์…
    </p>
  );
}
