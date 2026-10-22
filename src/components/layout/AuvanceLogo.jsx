import React from "react";

// Logotipo de Auvance (desarrollador de AuGmao).
export default function AuvanceLogo({ className = "" }) {
  return (
    <a
      href="https://auvance.com.ar/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Auvance"
      className={`inline-block text-cream/75 transition-colors duration-200 hover:text-brand-500 ${className}`}
    >
      <svg viewBox="0 0 1105 222" height="17" role="img" aria-hidden="true" fill="currentColor">
        <path
          d="M494.6 262Q512 240 529 262L650 462H617L512.5 293L428.7 430H489L470 462H376Z M512 352L580 462H544.5L510 406H480Z"
          transform="translate(-375 -241)"
        />
        <text x="330" y="167" textLength="770" fontSize="150" fontWeight="600" fontFamily="Montserrat, sans-serif" fill="currentColor">
          AUVANCE
        </text>
      </svg>
    </a>
  );
}