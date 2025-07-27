"use client";

import React from "react";
import styles from "./BottomBar.module.css";

const BottomBar: React.FC = () => {
  return (
    <div className={styles.bottomBar}>
      <div className={styles.tips}>
        Quick Tip: Press '?' for keyboard shortcuts
      </div>
      <div className={styles.status}>All changes saved</div>
      <div className={styles.actions}>
        <button>Undo</button>
        <button>Redo</button>
        <button>Help</button>
      </div>
    </div>
  );
};

export default BottomBar;
