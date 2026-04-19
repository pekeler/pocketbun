// PocketBun-only: runtime branding script injected into the vendored Admin UI index page.
(function pocketbunAdminBranding() {
  const authLabelId = "pocketbun-auth-label";
  const pocketbunRepoUrl = "https://github.com/pekeler/pocketbun";
  const pocketbunCreditLink = {
    href: pocketbunRepoUrl,
    icon: "ri-github-line",
    label: "PocketBun",
  };

  function ensureFooterLink() {
    const store = window.app?.store;
    const creditLinks = store?.creditLinks;
    if (!Array.isArray(creditLinks)) {
      return;
    }

    if (
      creditLinks.some(
        (link) =>
          link && typeof link === "object" && (link.href === pocketbunRepoUrl || link.label === pocketbunCreditLink.label),
      )
    ) {
      return;
    }

    store.creditLinks = [...creditLinks, { ...pocketbunCreditLink }];
  }

  function ensureAuthLabel(root = document) {
    if (document.getElementById(authLabelId)) {
      return;
    }

    const loginPage =
      root.querySelector?.('[data-pb="pageSuperuserLogin"]') ??
      document.querySelector('[data-pb="pageSuperuserLogin"]') ??
      root;
    const logo = loginPage.querySelector?.("img.main-logo");
    if (!(logo instanceof HTMLElement)) {
      return;
    }

    const header = logo.closest("header");
    const insertionTarget = header?.querySelector("h5") ?? logo;

    const label = document.createElement("div");
    label.id = authLabelId;
    label.textContent = "PocketBun backend";
    label.style.opacity = "0.7";
    label.style.marginTop = "10px";
    insertionTarget.insertAdjacentElement("afterend", label);
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
  document.addEventListener("mount:pageSuperuserLogin", (event) => {
    ensureAuthLabel(event.detail instanceof HTMLElement ? event.detail : document);
  });
})();
