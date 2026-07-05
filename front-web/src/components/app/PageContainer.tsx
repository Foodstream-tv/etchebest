import type { ReactNode } from "react";

function cx(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

type PageContainerProps = Readonly<{
  children: ReactNode;
  className?: string;
}>;

export default function PageContainer({
  children,
  className,
}: PageContainerProps) {
  return (
    <div
      className={cx(
        "mx-auto w-full px-4 sm:px-6",
        "lg:max-w-[1400px] xl:max-w-[1600px]",
        className
      )}
    >
      {children}
    </div>
  );
}