import React from "react";
import { useT } from "@/i18n";
import styles from "../workspace.module.css";

// Hand-drawn style arrows (our own curves) pointing from each hint to the control it describes.
const ArrowUpLeft = () => <svg className={styles.coachArrowTall} viewBox="0 0 64 78" aria-hidden="true"><path d="M50 74 C 44 52 30 40 12 30" /><path d="M10 40 L 11 29 L 22 27" /></svg>;
const ArrowUpRight = () => <svg className={styles.coachArrowTall} viewBox="0 0 64 78" aria-hidden="true"><path d="M14 74 C 20 52 34 40 52 30" /><path d="M42 27 L 53 29 L 54 40" /></svg>;
const ArrowDownLeft = () => <svg className={styles.coachArrowWide} viewBox="0 0 76 58" aria-hidden="true"><path d="M62 6 C 40 8 22 22 16 48" /><path d="M8 40 L 16 50 L 25 41" /></svg>;
const ArrowDownRight = () => <svg className={styles.coachArrowWide} viewBox="0 0 76 58" aria-hidden="true"><path d="M8 6 C 32 8 52 22 60 48" /><path d="M51 41 L 60 50 L 68 40" /></svg>;

/** First-run hints shown while the tree is empty (heritg.us coach marks 1–4). */
export function CoachMarks() {
  const t = useT();
  return <div className={styles.coachLayer} aria-hidden="true">
    <div className={`${styles.coach} ${styles.coachTrees}`}><ArrowUpLeft /><span><b>1</b>{t("coach.trees")}</span></div>
    <div className={`${styles.coach} ${styles.coachShare}`}><span><b>2</b>{t("coach.share")}</span><ArrowUpRight /></div>
    <div className={`${styles.coach} ${styles.coachView}`}><span><b>3</b>{t("coach.view")}</span><ArrowDownLeft /></div>
    <div className={`${styles.coach} ${styles.coachControls}`}><span><b>4</b>{t("coach.controls")}</span><ArrowDownRight /></div>
  </div>;
}
