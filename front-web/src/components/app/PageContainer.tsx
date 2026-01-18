"use client";

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export default function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
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
