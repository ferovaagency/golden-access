import { Link } from "react-router-dom";

/** Original Ferova isotipo, unmodified. “one” distinguishes the product. */
export function FerovaBrand() {
  return (
    <Link to="/" className="fo-brand" aria-label="Ferova One, inicio">
      <span className="fo-brand-mark">
        <img src="/brand/ferova-isotipo.png" alt="" width="28" height="35" />
      </span>
      <span>
        ferova<span className="fo-brand-one">one</span>
      </span>
    </Link>
  );
}
