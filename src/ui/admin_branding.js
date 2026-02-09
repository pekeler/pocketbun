// PocketBun-only: runtime branding script injected into the vendored Admin UI index page.
(function pocketbunAdminBranding() {
  const footerReleaseSelector = 'a[href*="github.com/pocketbase/pocketbase/releases"]';
  const footerLinkId = "pocketbun-footer-link";
  const authLabelId = "pocketbun-auth-label";
  const pocketbunRepoUrl = "https://github.com/pekeler/pocketbun";

  function ensureFooterLink() {
    const releaseLink = document.querySelector(footerReleaseSelector);
    if (!(releaseLink instanceof HTMLAnchorElement)) {
      return;
    }

    const parent = releaseLink.parentElement;
    if (!parent || parent.querySelector("#" + footerLinkId)) {
      return;
    }

    const separator = document.createElement("span");
    separator.textContent = " · ";
    separator.setAttribute("aria-hidden", "true");

    const link = document.createElement("a");
    link.id = footerLinkId;
    link.href = pocketbunRepoUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = "PocketBun";

    const text = document.createElement("span");
    text.className = "txt";
    text.textContent = "PocketBun";
    link.appendChild(text);

    parent.appendChild(separator);
    parent.appendChild(link);
  }

  function ensureAuthLabel() {
    if (document.getElementById(authLabelId)) {
      return;
    }

    const logo = document.querySelector("figure.logo");
    if (!(logo instanceof HTMLElement)) {
      return;
    }

    const label = document.createElement("div");
    label.id = authLabelId;
    label.textContent = "PocketBun backend";
    label.style.opacity = "0.7";
    logo.insertAdjacentElement("afterend", label);
  }

  function applyBranding() {
    ensureFooterLink();
    ensureAuthLabel();
  }

  let pending = false;
  const queueApply = () => {
    if (pending) {
      return;
    }
    pending = true;
    queueMicrotask(() => {
      pending = false;
      applyBranding();
    });
  };

  queueApply();
  const observer = new MutationObserver(queueApply);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  window.addEventListener("hashchange", queueApply);
})();
