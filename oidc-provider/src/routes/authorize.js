/**
 * /authorize endpoint
 * Handles Authorization Code Flow with PKCE
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User.js');
const AuthCode = require('../models/AuthCode.js');
const { getClient, validateRedirectUri } = require('../utils/clients.js');
const { validateChallengeMethod } = require('../utils/pkce.js');

const css = `
      *,
      *::before,
      *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      :root {
        --bg: #08090a;
        --surface: #0f1012;
        --surface2: #16181b;
        --surface3: #1e2124;
        --border: #2a2d32;
        --border2: #353a40;
        --text: #f0f1f3;
        --text2: #9ba3ae;
        --text3: #5c6370;
        --accent: #e8ff6b;
        --accent2: #c8e050;
        --accent-dim: rgba(232, 255, 107, 0.12);
        --accent-dim2: rgba(232, 255, 107, 0.06);
        --red: #ff5f5f;
        --red-dim: rgba(255, 95, 95, 0.08);
        --green: #4ade80;
        --blue: #60a5fa;
        --mono: "DM Mono", monospace;
        --display: "Syne", sans-serif;
        --sans: "DM Sans", sans-serif;
        --radius: 10px;
        --radius-lg: 16px;
      }
      html {
        scroll-behavior: smooth;
      }
      body {
        background: var(--bg);
        color: var(--text);
        font-family: var(--sans);
        font-size: 15px;
        line-height: 1.6;
        min-height: 100vh;
        overflow-x: hidden;
      }

      /* ─── SCROLLBAR ─── */
      ::-webkit-scrollbar {
        width: 4px;
        height: 4px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: var(--border2);
        border-radius: 10px;
      }

      /* ─── NAV ─── */
      nav {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 28px;
        height: 54px;
        background: rgba(8, 9, 10, 0.9);
        backdrop-filter: blur(16px);
        border-bottom: 1px solid var(--border);
      }
      .nav-logo {
        display: flex;
        align-items: center;
        gap: 9px;
        font-family: var(--display);
        font-weight: 600;
        font-size: 16px;
        color: var(--text);
        text-decoration: none;
        letter-spacing: -0.02em;
      }
      .nav-logo svg {
        color: var(--accent);
      }
      .nav-links {
        display: flex;
        align-items: center;
        gap: 2px;
      }
      .nav-links a {
        padding: 5px 13px;
        border-radius: 6px;
        font-size: 13px;
        color: var(--text2);
        text-decoration: none;
        transition: 0.15s;
        cursor: pointer;
      }
      .nav-links a:hover {
        color: var(--text);
        background: var(--surface2);
      }
      .nav-links a.active {
        color: var(--text);
        background: var(--surface3);
      }
      .nav-right {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      /* ─── BUTTONS ─── */
      .btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 16px;
        border-radius: 7px;
        font-size: 13px;
        font-weight: 500;
        font-family: var(--sans);
        cursor: pointer;
        transition: 0.15s;
        text-decoration: none;
        border: none;
        outline: none;
      }
      .btn-ghost {
        background: transparent;
        color: var(--text2);
        border: 1px solid var(--border);
      }
      .btn-ghost:hover {
        color: var(--text);
        border-color: var(--border2);
        background: var(--surface2);
      }
      .btn-accent {
        background: var(--accent);
        color: #080a00;
        border: 1px solid transparent;
        font-weight: 600;
      }
      .btn-accent:hover {
        background: var(--accent2);
        transform: translateY(-1px);
      }
      .btn-danger {
        background: var(--red-dim);
        color: var(--red);
        border: 1px solid rgba(255, 95, 95, 0.2);
      }
      .btn-danger:hover {
        background: rgba(255, 95, 95, 0.14);
      }
      .btn-sm {
        padding: 5px 11px;
        font-size: 12px;
      }
      .btn-lg {
        padding: 11px 24px;
        font-size: 14px;
      }
      .btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
        transform: none !important;
      }

      /* ─── PAGES ─── */
      .page {
        display: none;
        min-height: 100vh;
        padding-top: 54px;
      }
      .page.active {
        display: block;
      }

      /* ─── AUTH PAGES ─── */
      .auth-shell {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 80px 20px 40px;
      }
      .auth-shell::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background: radial-gradient(
          ellipse 700px 500px at 50% 20%,
          rgba(232, 255, 107, 0.05) 0%,
          transparent 70%
        );
      }
      .auth-card {
        width: 100%;
        max-width: 400px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 36px;
        position: relative;
        z-index: 1;
      }
      .auth-logo-mark {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 32px;
        font-family: var(--display);
        font-size: 15px;
        font-weight: 600;
        color: var(--text);
      }
      .auth-logo-mark svg {
        color: var(--accent);
      }
      .auth-title {
        font-family: var(--display);
        font-size: 24px;
        font-weight: 600;
        margin-bottom: 6px;
        letter-spacing: -0.02em;
      }
      .auth-sub {
        font-size: 13px;
        color: var(--text2);
        margin-bottom: 26px;
      }
      .form-group {
        margin-bottom: 16px;
      }
      .form-group label {
        display: block;
        font-size: 11px;
        font-family: var(--mono);
        color: var(--text3);
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .form-input {
        width: 100%;
        padding: 10px 13px;
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 8px;
        color: var(--text);
        font-size: 14px;
        font-family: var(--sans);
        outline: none;
        transition: 0.15s;
      }
      .form-input:focus {
        border-color: rgba(232, 255, 107, 0.35);
        background: var(--surface3);
      }
      .form-input::placeholder {
        color: var(--text3);
      }
      .form-input.err {
        border-color: rgba(255, 95, 95, 0.4);
      }
      .auth-submit {
        width: 100%;
        padding: 11px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        background: var(--accent);
        color: #080a00;
        font-size: 14px;
        font-weight: 600;
        font-family: var(--display);
        transition: 0.15s;
        letter-spacing: -0.01em;
      }
      .auth-submit:hover:not(:disabled) {
        background: var(--accent2);
        transform: translateY(-1px);
      }
      .auth-submit:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .auth-switch {
        text-align: center;
        font-size: 13px;
        color: var(--text3);
        margin-top: 20px;
      }
      .auth-switch a {
        color: var(--accent);
        text-decoration: none;
        cursor: pointer;
      }
      .form-error {
        padding: 9px 12px;
        background: var(--red-dim);
        border: 1px solid rgba(255, 95, 95, 0.2);
        border-radius: 7px;
        font-size: 12px;
        color: #ff9999;
        margin-bottom: 14px;
        display: none;
        font-family: var(--mono);
      }
      .form-error.show {
        display: block;
      }

      /* ─── HERO ─── */
      .hero {
        padding: 90px 0 60px;
        text-align: center;
        position: relative;
        overflow: hidden;
      }
      .hero-noise {
        position: absolute;
        inset: 0;
        opacity: 0.025;
        pointer-events: none;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
      }
      .hero-glow {
        position: absolute;
        top: -100px;
        left: 50%;
        transform: translateX(-50%);
        width: 700px;
        height: 500px;
        background: radial-gradient(
          ellipse at center top,
          rgba(232, 255, 107, 0.09) 0%,
          transparent 70%
        );
        pointer-events: none;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 4px 13px;
        border-radius: 20px;
        background: var(--accent-dim2);
        border: 1px solid rgba(232, 255, 107, 0.18);
        font-size: 11px;
        font-family: var(--mono);
        color: var(--accent);
        margin-bottom: 26px;
      }
      .badge-dot {
        width: 5px;
        height: 5px;
        background: var(--accent);
        border-radius: 50%;
        animation: blink 2s infinite;
      }
      @keyframes blink {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.3;
        }
      }
      h1.hero-title {
        font-family: var(--display);
        font-size: clamp(42px, 7vw, 74px);
        font-weight: 700;
        line-height: 1.05;
        margin-bottom: 20px;
        color: var(--text);
        letter-spacing: -0.03em;
      }
      h1.hero-title em {
        font-style: normal;
        color: var(--accent);
      }
      .hero-sub {
        font-size: 16px;
        color: var(--text2);
        max-width: 480px;
        margin: 0 auto 36px;
        line-height: 1.75;
      }
      .hero-actions {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
      }

      /* ─── SETUP ─── */
      .setup-wrap {
        padding: 0 28px 100px;
        max-width: 880px;
        margin: 0 auto;
      }
      .section-eyebrow {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 44px;
        font-family: var(--mono);
        font-size: 11px;
        color: var(--text3);
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }
      .section-eyebrow::after {
        content: "";
        flex: 1;
        height: 1px;
        background: var(--border);
      }

      .step-timeline {
        position: relative;
        padding-left: 52px;
      }
      .step-timeline::before {
        content: "";
        position: absolute;
        left: 16px;
        top: 16px;
        bottom: 40px;
        width: 1px;
        background: linear-gradient(
          to bottom,
          var(--border2) 0%,
          var(--border) 60%,
          transparent 100%
        );
      }
      .step {
        position: relative;
        margin-bottom: 44px;
      }
      .step-num {
        position: absolute;
        left: -52px;
        top: 0;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--surface2);
        border: 1px solid var(--border2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--mono);
        font-size: 10px;
        color: var(--text3);
      }
      .step.done .step-num {
        background: var(--accent-dim);
        border-color: rgba(232, 255, 107, 0.35);
        color: var(--accent);
        font-size: 14px;
      }
      .step-head {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 6px;
      }
      .step-title {
        font-family: var(--display);
        font-size: 17px;
        font-weight: 600;
        color: var(--text);
        letter-spacing: -0.02em;
      }
      .step-tag {
        font-size: 10px;
        font-family: var(--mono);
        color: var(--text3);
        padding: 2px 8px;
        background: var(--surface2);
        border-radius: 4px;
        border: 1px solid var(--border);
      }
      .step-desc {
        font-size: 14px;
        color: var(--text2);
        margin-bottom: 16px;
      }

      /* code blocks */
      .code-block {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        overflow: hidden;
        margin-bottom: 12px;
      }
      .code-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 7px 13px;
        background: var(--surface2);
        border-bottom: 1px solid var(--border);
      }
      .code-lang {
        font-family: var(--mono);
        font-size: 10px;
        color: var(--text3);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .code-copy {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 11px;
        font-family: var(--mono);
        color: var(--text3);
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 2px 7px;
        border-radius: 4px;
        transition: 0.15s;
      }
      .code-copy:hover {
        color: var(--text);
        background: var(--surface3);
      }
      .code-copy.copied {
        color: var(--green);
      }
      pre {
        padding: 18px 16px;
        overflow-x: auto;
        font-family: var(--mono);
        font-size: 12.5px;
        line-height: 1.7;
      }
      .tok-k {
        color: #c792ea;
      }
      .tok-s {
        color: var(--accent);
      }
      .tok-c {
        color: var(--text3);
        font-style: italic;
      }
      .tok-f {
        color: var(--blue);
      }
      .tok-n {
        color: #f78c6c;
      }
      .tok-p {
        color: #89ddff;
      }

      /* inline code */
      code.inline {
        font-family: var(--mono);
        font-size: 12px;
        color: var(--accent);
        background: var(--accent-dim2);
        padding: 1px 6px;
        border-radius: 4px;
        border: 1px solid rgba(232, 255, 107, 0.1);
      }

      /* info/warning boxes */
      .info-box,
      .warn-box {
        display: flex;
        gap: 10px;
        padding: 11px 14px;
        border-radius: var(--radius);
        font-size: 13px;
        color: var(--text2);
        margin-bottom: 12px;
      }
      .info-box {
        background: var(--accent-dim2);
        border: 1px solid rgba(232, 255, 107, 0.12);
      }
      .warn-box {
        background: var(--red-dim);
        border: 1px solid rgba(255, 95, 95, 0.18);
        color: #ffaaaa;
      }
      .info-box svg,
      .warn-box svg {
        flex-shrink: 0;
        margin-top: 2px;
        color: var(--accent);
      }
      .warn-box svg {
        color: var(--red);
      }

      /* cred display */
      .cred-box {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 12px;
      }
      .cred-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .cred-label {
        font-family: var(--mono);
        font-size: 10px;
        color: var(--text3);
        min-width: 95px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .cred-value {
        font-family: var(--mono);
        font-size: 12px;
        color: var(--text);
        background: var(--surface2);
        padding: 6px 10px;
        border-radius: 5px;
        border: 1px solid var(--border);
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .cred-copy {
        background: none;
        border: 1px solid var(--border);
        border-radius: 5px;
        padding: 4px 9px;
        font-size: 11px;
        font-family: var(--mono);
        color: var(--text3);
        cursor: pointer;
        transition: 0.15s;
      }
      .cred-copy:hover {
        color: var(--accent);
        border-color: rgba(232, 255, 107, 0.3);
      }
      .cred-copy.copied {
        color: var(--green);
        border-color: rgba(74, 222, 128, 0.3);
      }

      /* tab bar */
      .tab-bar {
        display: flex;
        gap: 2px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 3px;
        margin-bottom: 14px;
        overflow-x: auto;
      }
      .tab-btn {
        flex: 1;
        padding: 6px 13px;
        border-radius: 5px;
        border: none;
        background: none;
        font-size: 12px;
        font-family: var(--mono);
        color: var(--text3);
        cursor: pointer;
        transition: 0.12s;
        white-space: nowrap;
      }
      .tab-btn:hover {
        color: var(--text2);
      }
      .tab-btn.active {
        background: var(--surface3);
        color: var(--text);
      }
      .tab-content {
        display: none;
      }
      .tab-content.active {
        display: block;
      }

      /* field rows */
      .field-row {
        display: flex;
        gap: 10px;
        margin-bottom: 12px;
        flex-wrap: wrap;
      }
      .field-group {
        flex: 1;
        min-width: 170px;
      }
      .field-group label {
        display: block;
        font-size: 11px;
        font-family: var(--mono);
        color: var(--text3);
        margin-bottom: 5px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .field-group input,
      .field-group select {
        width: 100%;
        padding: 9px 12px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 7px;
        color: var(--text);
        font-size: 13px;
        font-family: var(--sans);
        outline: none;
        transition: 0.15s;
      }
      .field-group input:focus,
      .field-group select:focus {
        border-color: rgba(232, 255, 107, 0.3);
        background: var(--surface2);
      }
      .field-group input::placeholder {
        color: var(--text3);
      }

      /* snippet card */
      .snippet-card {
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        overflow: hidden;
        margin-bottom: 20px;
      }
      .snippet-tabs {
        display: flex;
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        overflow-x: auto;
      }
      .snippet-tab {
        padding: 9px 16px;
        font-size: 12px;
        font-family: var(--mono);
        color: var(--text3);
        cursor: pointer;
        transition: 0.12s;
        border: none;
        background: none;
        border-bottom: 2px solid transparent;
        white-space: nowrap;
      }
      .snippet-tab:hover {
        color: var(--text2);
      }
      .snippet-tab.active {
        color: var(--accent);
        border-bottom-color: var(--accent);
      }

      /* ─── DASHBOARD ─── */
      .dash-layout {
        display: flex;
        min-height: calc(100vh - 54px);
      }
      .sidebar {
        width: 216px;
        flex-shrink: 0;
        background: var(--surface);
        border-right: 1px solid var(--border);
        padding: 16px 0;
        position: sticky;
        top: 54px;
        height: calc(100vh - 54px);
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      }
      .sidebar-section {
        padding: 0 10px;
        margin-bottom: 20px;
      }
      .sidebar-label {
        font-size: 10px;
        font-family: var(--mono);
        color: var(--text3);
        padding: 0 8px;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }
      .sidebar-link {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 7px 10px;
        border-radius: 7px;
        font-size: 13px;
        color: var(--text2);
        cursor: pointer;
        transition: 0.1s;
        border: none;
        background: none;
        width: 100%;
        text-align: left;
      }
      .sidebar-link:hover {
        color: var(--text);
        background: var(--surface2);
      }
      .sidebar-link.active {
        color: var(--text);
        background: var(--surface3);
      }
      .sidebar-link svg {
        opacity: 0.6;
        flex-shrink: 0;
      }
      .sidebar-link.active svg {
        opacity: 1;
      }
      .sidebar-badge {
        margin-left: auto;
        font-size: 10px;
        font-family: var(--mono);
        background: var(--accent-dim);
        color: var(--accent);
        padding: 1px 6px;
        border-radius: 8px;
      }
      .sidebar-user {
        padding: 12px 18px;
        border-top: 1px solid var(--border);
        margin-top: auto;
      }
      .user-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--accent-dim);
        border: 1px solid rgba(232, 255, 107, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-family: var(--mono);
        color: var(--accent);
        flex-shrink: 0;
      }

      .dash-main {
        flex: 1;
        padding: 32px 36px;
        overflow-y: auto;
        max-width: auto;
      }
      .dash-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: 28px;
        gap: 12px;
      }
      .page-title {
        font-family: var(--display);
        font-size: 21px;
        font-weight: 600;
        color: var(--text);
        letter-spacing: -0.02em;
      }
      .page-sub {
        font-size: 12px;
        color: var(--text3);
        margin-top: 3px;
        font-family: var(--mono);
      }

      /* stat cards */
      .stats-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 10px;
        margin-bottom: 28px;
      }
      .stat-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 16px;
      }
      .stat-val {
        font-size: 24px;
        font-weight: 700;
        font-family: var(--display);
        color: var(--text);
        letter-spacing: -0.02em;
      }
      .stat-label {
        font-size: 11px;
        color: var(--text3);
        margin-top: 3px;
        font-family: var(--mono);
      }
      .stat-delta {
        font-size: 11px;
        color: var(--green);
        margin-top: 5px;
        font-family: var(--mono);
      }

      /* app cards */
      .apps-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
        gap: 12px;
        margin-bottom: 24px;
      }
      .app-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 20px;
        cursor: pointer;
        transition: 0.15s;
        position: relative;
      }
      .app-card:hover {
        border-color: var(--border2);
        background: var(--surface2);
        transform: translateY(-1px);
      }
      .app-card-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: 14px;
      }
      .app-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--surface3);
        border: 1px solid var(--border);
      }
      .status-badge {
        font-size: 10px;
        font-family: var(--mono);
        padding: 3px 8px;
        border-radius: 8px;
      }
      .status-live {
        background: rgba(74, 222, 128, 0.08);
        color: var(--green);
        border: 1px solid rgba(74, 222, 128, 0.18);
      }
      .status-dev {
        background: rgba(96, 165, 250, 0.08);
        color: var(--blue);
        border: 1px solid rgba(96, 165, 250, 0.18);
      }
      .app-name {
        font-size: 15px;
        font-weight: 600;
        font-family: var(--display);
        letter-spacing: -0.01em;
        margin-bottom: 3px;
      }
      .app-cid {
        font-family: var(--mono);
        font-size: 10px;
        color: var(--text3);
      }
      .app-meta {
        display: flex;
        gap: 14px;
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid var(--border);
      }
      .app-meta-item {
        font-size: 10px;
        color: var(--text3);
        font-family: var(--mono);
      }
      .app-meta-item span {
        display: block;
        font-size: 12px;
        color: var(--text2);
        margin-top: 1px;
      }
      .app-new-card {
        border-style: dashed;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 8px;
        min-height: 150px;
      }
      .app-new-card:hover {
        border-color: rgba(232, 255, 107, 0.2) !important;
      }
      .app-new-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        border: 1px solid var(--border2);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text3);
      }

      /* table */
      .table-wrap {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      thead tr {
        background: var(--surface2);
      }
      th {
        padding: 9px 14px;
        text-align: left;
        font-size: 10px;
        font-family: var(--mono);
        color: var(--text3);
        font-weight: 400;
        border-bottom: 1px solid var(--border);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      td {
        padding: 11px 14px;
        font-size: 12px;
        color: var(--text2);
        border-bottom: 1px solid var(--border);
      }
      tr:last-child td {
        border-bottom: none;
      }
      tr:hover td {
        background: rgba(255, 255, 255, 0.01);
      }
      .method-tag {
        font-family: var(--mono);
        font-size: 10px;
        padding: 2px 7px;
        border-radius: 4px;
      }
      .method-post {
        background: rgba(74, 222, 128, 0.08);
        color: var(--green);
      }
      .method-get {
        background: rgba(96, 165, 250, 0.08);
        color: var(--blue);
      }
      .method-del {
        background: var(--red-dim);
        color: var(--red);
      }
      .status-200 {
        color: var(--green);
        font-family: var(--mono);
        font-size: 11px;
      }
      .status-401 {
        color: var(--red);
        font-family: var(--mono);
        font-size: 11px;
      }
      .status-500 {
        color: #f78c6c;
        font-family: var(--mono);
        font-size: 11px;
      }

      /* app detail */
      .detail-header {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 22px;
        margin-bottom: 20px;
      }
      .detail-top {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        margin-bottom: 0;
      }
      .detail-icon {
        width: 48px;
        height: 48px;
        border-radius: 11px;
        background: var(--surface3);
        border: 1px solid var(--border);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .detail-title {
        font-family: var(--display);
        font-size: 18px;
        font-weight: 600;
        letter-spacing: -0.02em;
      }
      .detail-meta {
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
        margin-top: 5px;
      }
      .detail-meta span {
        font-size: 11px;
        color: var(--text3);
        font-family: var(--mono);
      }
      .detail-section {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 20px;
        margin-bottom: 14px;
      }
      .detail-section-title {
        font-size: 13px;
        font-weight: 600;
        font-family: var(--display);
        margin-bottom: 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: var(--text);
      }

      /* token management section */
      .token-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 8px;
        margin-bottom: 8px;
      }
      .token-icon {
        width: 32px;
        height: 32px;
        border-radius: 7px;
        background: var(--surface3);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .token-info {
        flex: 1;
        min-width: 0;
      }
      .token-name {
        font-size: 13px;
        font-weight: 500;
        color: var(--text);
      }
      .token-desc {
        font-size: 11px;
        color: var(--text3);
        font-family: var(--mono);
      }
      .token-status-ok {
        font-size: 10px;
        font-family: var(--mono);
        color: var(--green);
        background: rgba(74, 222, 128, 0.08);
        padding: 2px 7px;
        border-radius: 4px;
        border: 1px solid rgba(74, 222, 128, 0.2);
      }
      .token-status-err {
        font-size: 10px;
        font-family: var(--mono);
        color: var(--red);
        background: var(--red-dim);
        padding: 2px 7px;
        border-radius: 4px;
        border: 1px solid rgba(255, 95, 95, 0.2);
      }

      /* session table */
      .session-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border-bottom: 1px solid var(--border);
      }
      .session-row:last-child {
        border-bottom: none;
      }
      .session-device {
        font-size: 13px;
        color: var(--text);
      }
      .session-meta {
        font-size: 11px;
        color: var(--text3);
        font-family: var(--mono);
        margin-top: 2px;
      }

      /* uri tags */
      .uri-list {
        display: flex;
        flex-direction: column;
        gap: 7px;
        margin-bottom: 12px;
      }
      .uri-tag {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 7px;
        padding: 7px 11px;
        font-family: var(--mono);
        font-size: 12px;
        color: var(--text2);
      }
      .uri-del {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--text3);
        font-size: 16px;
        line-height: 1;
        transition: 0.12s;
        padding: 0 2px;
      }
      .uri-del:hover {
        color: var(--red);
      }
      .uri-add {
        display: flex;
        gap: 8px;
        margin-top: 8px;
      }
      .uri-add input {
        flex: 1;
        padding: 7px 11px;
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 7px;
        color: var(--text);
        font-family: var(--mono);
        font-size: 12px;
        outline: none;
      }
      .uri-add input:focus {
        border-color: rgba(232, 255, 107, 0.3);
      }

      /* modal */
      .modal-overlay {
        position: fixed;
        inset: 0;
        z-index: 200;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(6px);
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      .modal-overlay.open {
        display: flex;
      }
      .modal {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        width: 100%;
        max-width: 460px;
        padding: 28px;
        position: relative;
      }
      .modal-close {
        position: absolute;
        top: 14px;
        right: 14px;
        background: none;
        border: none;
        color: var(--text3);
        font-size: 18px;
        cursor: pointer;
        line-height: 1;
        transition: 0.15s;
      }
      .modal-close:hover {
        color: var(--text);
      }
      .modal-title {
        font-family: var(--display);
        font-size: 17px;
        font-weight: 600;
        margin-bottom: 5px;
        letter-spacing: -0.02em;
      }
      .modal-sub {
        font-size: 13px;
        color: var(--text2);
        margin-bottom: 20px;
      }

      /* toast */
      .toast {
        position: fixed;
        bottom: 22px;
        right: 22px;
        z-index: 300;
        background: var(--surface2);
        border: 1px solid var(--border2);
        border-radius: var(--radius);
        padding: 11px 15px;
        font-size: 13px;
        color: var(--text);
        display: flex;
        align-items: center;
        gap: 8px;
        transform: translateY(70px);
        opacity: 0;
        transition: 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        pointer-events: none;
        max-width: 280px;
        font-family: var(--mono);
        font-size: 12px;
      }
      .toast.show {
        transform: translateY(0);
        opacity: 1;
      }
      .toast-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--green);
        flex-shrink: 0;
      }
      .toast-dot.warn {
        background: var(--accent);
      }
      .toast-dot.err {
        background: var(--red);
      }

      /* spinner */
      .spin {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid rgba(8, 10, 0, 0.3);
        border-top-color: #080a00;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
      }
      .spin-light {
        border-color: rgba(232, 255, 107, 0.2);
        border-top-color: var(--accent);
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      /* loading overlay */
      .loading-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 40px;
        color: var(--text3);
        font-family: var(--mono);
        font-size: 12px;
      }

      /* verify result */
      .verify-result {
        padding: 14px;
        border-radius: var(--radius);
        font-family: var(--mono);
        font-size: 12px;
        margin-top: 12px;
        display: none;
        border: 1px solid var(--border);
        background: var(--surface2);
        white-space: pre-wrap;
        word-break: break-all;
        color: var(--text2);
        max-height: 240px;
        overflow-y: auto;
        line-height: 1.6;
      }
      .verify-result.show {
        display: block;
      }
      .verify-result.ok {
        border-color: rgba(74, 222, 128, 0.2);
        background: rgba(74, 222, 128, 0.04);
      }
      .verify-result.fail {
        border-color: rgba(255, 95, 95, 0.2);
        background: var(--red-dim);
        color: #ff9999;
      }

      @media (max-width: 700px) {
        .dash-layout {
          flex-direction: column;
        }
        .sidebar {
          width: 100%;
          height: auto;
          position: static;
          flex-direction: row;
          padding: 8px;
          overflow-x: auto;
        }
        .sidebar-section {
          margin: 0;
          display: flex;
          gap: 4px;
        }
        .sidebar-label,
        .sidebar-user {
          display: none;
        }
        .dash-main {
          padding: 20px 16px;
        }
        nav {
          padding: 0 14px;
        }
        .setup-wrap {
          padding: 0 16px 60px;
        }
        .step-timeline {
          padding-left: 38px;
        }
      }`
// GET /authorize - Show login/consent page or validate and redirect
router.get('/', async (req, res) => {
  const {
    client_id,
    redirect_uri,
    response_type,
    scope,
    state,
    code_challenge,
    code_challenge_method,
    nonce,
  } = req.query;
console.log("STATE GENERATED:", state);
  // --- Validate required params ---
  if (!client_id || !redirect_uri || !response_type || !code_challenge || !code_challenge_method) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'Missing required parameters' });
  }

  if (response_type !== 'code') {
    return res.status(400).json({ error: 'unsupported_response_type' });
  }

  try {
    validateChallengeMethod(code_challenge_method);
  } catch (e) {
    return res.status(400).json({ error: 'invalid_request', error_description: e.message });
  }

  const client = await getClient(client_id);
  if (!client) {
    return res.status(401).json({ error: 'invalid_client', error_description: 'Unknown client_id' });
  }

  if (!validateRedirectUri(client, redirect_uri)) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri not registered' });
  }

  // Store auth params in session for POST /authorize
  req.session = req.session || {};

  // Render login page (HTML form) - in production use a proper template engine
  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>Sign in - ${client.name || client_id}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link
      href="https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,400;0,500;1,400&family=Syne:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap"
      rel="stylesheet"
    />
<style>
${css}

body {
  background: var(--bg);
}
</style>
</head>

<body>

<div class="auth-shell">
  <div class="auth-card">

    <div class="auth-logo-mark">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1.2" fill="currentColor"></rect>
              <rect x="9" y="1" width="6" height="6" rx="1.2" fill="currentColor" opacity=".5"></rect>
              <rect x="1" y="9" width="6" height="6" rx="1.2" fill="currentColor" opacity=".5"></rect>
              <rect x="9" y="9" width="6" height="6" rx="1.2" fill="currentColor" opacity=".25"></rect>
            </svg>
      OAauth
    </div>

    <div class="auth-title" id="title">Sign in</div>
    <div class="auth-sub">
      to continue to <b>${client.name || client_id}</b>
    </div>

    ${req.query.error ? `<div class="form-error show">${decodeURIComponent(req.query.error)}</div>` : ''}

    <form id="auth-form" method="POST" action="/authorize/submit">

      <!-- OIDC hidden fields -->
      <input type="hidden" name="client_id" value="${client_id}">
      <input type="hidden" name="redirect_uri" value="${redirect_uri}">
      <input type="hidden" name="scope" value="${scope || 'openid profile email'}">
      <input type="hidden" name="state" value="${state || ''}">
      <input type="hidden" name="code_challenge" value="${code_challenge}">
      <input type="hidden" name="code_challenge_method" value="${code_challenge_method}">
      ${nonce ? `<input type="hidden" name="nonce" value="${nonce}">` : ''}

      <!-- NAME (signup only) -->
      <div class="form-group" id="name-field" style="display:none;">
        <label>Full name</label>
        <input class="form-input" type="text" name="name" placeholder="Jane Dev" />
      </div>

      <!-- EMAIL -->
      <div class="form-group">
        <label>Email</label>
        <input class="form-input" type="email" name="email" placeholder="you@example.com" required />
      </div>

      <!-- PASSWORD -->
      <div class="form-group">
        <label>Password</label>
        <input class="form-input" type="password" placeholder="••••••••" name="password" required />
      </div>

      <button class="auth-submit" type="submit" id="submit-btn">
        Continue
      </button>
    </form>

    <p class="auth-switch">
      <span id="toggle-text">Don't have an account?</span>
      <a onclick="toggleMode()">Sign up</a>
    </p>

  </div>
</div>

<script>
let isSignup = false;

function toggleMode() {
  isSignup = !isSignup;

  document.getElementById('name-field').style.display =
    isSignup ? 'block' : 'none';

  document.getElementById('submit-btn').textContent =
    isSignup ? 'Create account' : 'Continue';

  document.getElementById('title').textContent =
    isSignup ? 'Create account' : 'Sign in';

  document.getElementById('toggle-text').textContent =
    isSignup ? 'Already have an account?' : "Don't have an account?";

  document.querySelector('.auth-switch a').textContent =
    isSignup ? 'Sign in' : 'Sign up';
}

document.getElementById('auth-form').addEventListener('submit', async function(e) {

  if (!isSignup) return;

  e.preventDefault();

  const form = e.target;

  const data = {
    name: form.name.value,
    email: form.email.value,
    password: form.password.value
  };

  try {
    const res = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error_description || 'Signup failed');
      return;
    }

    // switch to login and submit
    isSignup = false;
    form.submit();

  } catch (err) {
    alert('Network error');
  }

});
</script>

</body>
</html>
`;

  res.send(html);
});

// POST /authorize/submit - Process login form
router.post('/submit', express.urlencoded({ extended: true }), async (req, res) => {
  const {
    email,
    password,
    client_id,
    redirect_uri,
    scope,
    state,
    code_challenge,
    code_challenge_method,
    nonce,
  } = req.body;

  const errorRedirect = (msg) => {
    const params = new URLSearchParams({
      client_id, redirect_uri, scope, state: state || '',
      code_challenge, code_challenge_method,
      error: encodeURIComponent(msg),
    });
    if (nonce) params.set('nonce', nonce);
    return res.redirect(`/authorize?${params.toString()}`);
  };

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.passwordHash) {
      return errorRedirect('Invalid email or password');
    }

    const valid = await user.verifyPassword(password);
    if (!valid) {
      return errorRedirect('Invalid email or password');
    }

    // Generate authorization code
    const code = crypto.randomBytes(32).toString('hex');

    await AuthCode.create({
      code,
      clientId: client_id,
      userId: user.sub,
      redirectUri: redirect_uri,
      scope: scope || 'openid profile email',
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method,
      nonce,
    });

    // Redirect back to client
    const callbackUrl = new URL(redirect_uri);
    callbackUrl.searchParams.set('code', code);
    if (state) callbackUrl.searchParams.set('state', state);

    return res.redirect(callbackUrl.toString());
  } catch (err) {
    console.error('[Authorize] Error:', err);
    return errorRedirect('An internal error occurred');
  }
});

module.exports = router;