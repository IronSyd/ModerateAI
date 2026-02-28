import type { HTMLAttributes, ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SectionProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

export function PageHeroShell({ className, children, ...props }: SectionProps) {
  return (
    <section
      className={cn(
        "ui-page-hero-shell wave-v2-hero rounded-2xl border border-border/70 px-5 py-5 md:px-7 md:py-6",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function PageSectionCard({ className, children, ...props }: SectionProps) {
  return (
    <Card
      className={cn("ui-section-card rounded-xl border border-border/70 bg-card/70", className)}
      {...props}
    >
      {children}
    </Card>
  );
}

export function FilterBarShell({ className, children, ...props }: SectionProps) {
  return (
    <div
      className={cn(
        "ui-filter-shell rounded-xl border border-border/70 bg-card/60 px-4 py-4 md:px-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function TableShell({ className, children, ...props }: SectionProps) {
  return (
    <div
      className={cn("ui-table-shell overflow-hidden rounded-xl border border-border/70 bg-card/60", className)}
      {...props}
    >
      {children}
    </div>
  );
}

type StateBlockProps = SectionProps & {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
};

export function StateBlock({
  className,
  title,
  description,
  icon,
  actions,
  children,
  ...props
}: StateBlockProps) {
  return (
    <div
      className={cn(
        "ui-state-block rounded-xl border border-border/70 bg-card/60 px-5 py-6 md:px-6",
        className,
      )}
      {...props}
    >
      {(title || description || icon || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {icon ? <div className="text-primary">{icon}</div> : null}
            <div>
              {title ? <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3> : null}
              {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </div>
  );
}
