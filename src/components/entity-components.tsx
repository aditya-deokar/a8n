import { AlertTriangleIcon, Loader2Icon, MoreVerticalIcon, PackageOpenIcon, PlusIcon, SearchIcon, TrashIcon, XIcon } from "lucide-react";
import { Button } from "./ui/button";
import Link from "next/link";
import { Input } from "./ui/input";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./ui/empty";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

type EntityHeaderProps = {
  title: string;
  description?: string;
  newButtonLabel?: string;
  disabled?: boolean;
  isCreating?: boolean;
  isOpen?: boolean;
} & (
    | { onNew: () => void; newButtonHref?: never }
    | { newButtonHref: string; onNew?: never }
    | { onNew?: never; newButtonHref?: never }
  );

export const EntityHeader = ({
  title,
  description,
  onNew,
  newButtonHref,
  newButtonLabel,
  disabled,
  isCreating,
  isOpen,
}: EntityHeaderProps) => {
  return (
    <div className="flex flex-row items-center justify-between gap-x-4 w-full">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{title}</h1>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {description}
          </p>
        )}
      </div>
      {onNew && !newButtonHref && (
        <Button
          disabled={isCreating || disabled}
          size="default"
          onClick={onNew}
          className={cn(
            "rounded-xl px-5 gap-2 h-11 transition-all",
            isOpen 
              ? "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-none"
              : "bg-[#5c54a4] hover:bg-[#4a4387] text-white shadow-sm shadow-[#5c54a4]/20"
          )}
        >
          {isOpen ? (
            <>
              <XIcon className="size-4" />
              <span>Close Panel</span>
            </>
          ) : (
            <>
              <PlusIcon className="size-4" />
              {newButtonLabel}
            </>
          )}
        </Button>
      )}
      {newButtonHref && !onNew && (
        <Button
          size="default"
          asChild
          className="bg-[#5c54a4] hover:bg-[#4a4387] text-white rounded-xl px-5 shadow-sm shadow-[#5c54a4]/20 gap-2 h-11"
        >
          <Link href={newButtonHref} prefetch>
            <PlusIcon className="size-4" />
            {newButtonLabel}
          </Link>
        </Button>
      )}
    </div>
  );
};

type EntityContainerProps = {
  children: React.ReactNode;
  header?: React.ReactNode;
  search?: React.ReactNode;
  pagination?: React.ReactNode;
};

export const EntityContainer = ({
  children,
  header,
  search,
  pagination,
}: EntityContainerProps) => {
  return (
    <div className="h-full w-full bg-[#f6f8fb] dark:bg-zinc-900 rounded-[1.5rem] border-4 border-white/40 dark:border-zinc-800/40 shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 md:px-10 md:py-6 flex-1 overflow-y-auto min-h-0">
        <div className="mx-auto max-w-screen-xl w-full flex flex-col gap-y-8 h-full">
          {header}
          <div className="flex flex-col gap-y-4 h-full">
            {search}
            {children}
          </div>
          {pagination}
        </div>
      </div>
    </div>
  )
};

interface EntitySearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export const EntitySearch = ({
  value,
  onChange,
  placeholder = "Search",
}: EntitySearchProps) => {
  return (
    <div className="relative ml-auto">
      <SearchIcon className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
      <Input
        className="max-w-[200px] bg-white dark:bg-zinc-900 h-10 pl-10 pr-4 rounded-xl text-sm border-gray-100 dark:border-zinc-800 shadow-[0_2px_10px_rgba(0,0,0,0.02)] focus-visible:ring-2 focus-visible:ring-[#6b62bd]/20 focus-visible:ring-offset-0 transition-all placeholder:text-gray-400 dark:text-zinc-100"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

interface EntityPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
};

export const EntityPagination = ({
  page,
  totalPages,
  onPageChange,
  disabled,
}: EntityPaginationProps) => {
  return (
    <div className="flex items-center justify-between gap-x-2 w-full">
      <div className="flex-1 text-sm text-muted-foreground">
        Page {page} of {totalPages || 1}
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          disabled={page === 1 || disabled}
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Previous
        </Button>
        <Button
          disabled={page === totalPages || totalPages === 0 || disabled}
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  )
};

interface StateViewProps {
  message?: string;
};

export const LoadingView = ({
  message,
}: StateViewProps) => {
  return (
    <div className="flex justify-center items-center h-full flex-1 flex-col gap-y-4">
      <Loader2Icon className="size-6 animate-spin text-primary" />
      {!!message && (
        <p className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
};


export const ErrorView = ({
  message,
}: StateViewProps) => {
  return (
    <div className="flex justify-center items-center h-full flex-1 flex-col gap-y-4">
      <AlertTriangleIcon className="size-6 text-primary" />
      {!!message && (
        <p className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
};

interface EmptyViewProps extends StateViewProps {
  onNew?: () => void;
};

export const EmptyView = ({
  message,
  onNew
}: EmptyViewProps) => {
  return (
    <Empty className="border border-dashed bg-white dark:bg-zinc-900/50 dark:border-zinc-800 rounded-2xl">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="dark:bg-zinc-800 dark:text-zinc-400">
          <PackageOpenIcon />
        </EmptyMedia>
      </EmptyHeader>
      <EmptyTitle className="dark:text-zinc-100">
        No items
      </EmptyTitle>
      {!!message && (
        <EmptyDescription className="dark:text-zinc-400">
          {message}
        </EmptyDescription>
      )}
      {!!onNew && (
        <EmptyContent>
          <Button onClick={onNew} className="bg-[#5c54a4] hover:bg-[#4a4387] text-white rounded-xl px-5 shadow-sm shadow-[#5c54a4]/20 gap-2 transition-all">
            Add item
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
};

interface EntityListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  getKey?: (item: T, index: number) => string | number;
  emptyView?: React.ReactNode;
  className?: string;
};

export function EntityList<T>({
  items,
  renderItem,
  getKey,
  emptyView,
  className,
}: EntityListProps<T>) {
  if (items.length === 0 && emptyView) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <div className="max-w-sm mx-auto">{emptyView}</div>
      </div>
    );
  }

  return (
    <div className={cn(
      "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",
      className,
    )}>
      {items.map((item, index) => (
        <div key={getKey ? getKey(item, index) : index} className="h-full">
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
};

export const EntitySkeletonList = ({
  count = 6,
}: {
  count?: number;
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <Card
          key={index}
          className="h-full p-5 bg-white dark:bg-[#111111]/80 backdrop-blur-xl border border-gray-100 dark:border-white/[0.08] shadow-sm rounded-[1.5rem]"
        >
          <CardContent className="flex flex-row items-center justify-between p-0">
            <div className="flex items-center gap-3 w-full">
              <Skeleton className="size-[50px] rounded-2xl flex-shrink-0 dark:bg-zinc-800" />
              <div className="flex flex-col gap-2.5 w-full">
                <Skeleton className="h-4 w-[60%] rounded-md dark:bg-zinc-800" />
                <Skeleton className="h-3 w-[80%] rounded-md dark:bg-zinc-800" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

interface EntityItemProps {
  href?: string;
  onClick?: () => void;
  title: string;
  subtitle?: React.ReactNode;
  image?: React.ReactNode;
  actions?: React.ReactNode;
  onRemove?: () => void | Promise<void>;
  isRemoving?: boolean;
  isSelected?: boolean;
  className?: string;
};

export const EntityItem = ({
  href,
  onClick,
  title,
  subtitle,
  image,
  actions,
  onRemove,
  isRemoving,
  isSelected,
  className,
}: EntityItemProps) => {
  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isRemoving) {
      return;
    }

    if (onRemove) {
      await onRemove();
    }
  }

  const InnerCard = (
    <Card
      className={cn(
        "h-full p-5 bg-white dark:bg-[#111111]/80 backdrop-blur-xl border border-gray-100 dark:border-white/[0.08] shadow-sm hover:shadow-md dark:shadow-none hover:bg-gray-50 dark:hover:bg-[#1c1c1e]/80 rounded-[1.5rem] cursor-pointer transition-all duration-300 group",
        isRemoving && "opacity-50 cursor-not-allowed",
        isSelected && "ring-2 ring-[#5c54a4] dark:ring-indigo-500 bg-gray-50 dark:bg-[#1c1c1e]/80",
        className,
      )}
    >
      <CardContent className="flex flex-row items-center justify-between p-0">
        <div className="flex items-center gap-3">
          {image}
          <div>
            <CardTitle className="text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100 group-hover:text-[#6b62bd] dark:group-hover:text-[#8b82dd] transition-colors">
              {title}
            </CardTitle>
            {!!subtitle && (
              <CardDescription className="text-[13px] text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                {subtitle}
              </CardDescription>
            )}
          </div>
        </div>
        {(actions || onRemove) && (
          <div className="flex gap-x-4 items-center">
            {actions}
            {onRemove && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVerticalIcon className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenuItem onClick={handleRemove}>
                    <TrashIcon className="size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} prefetch className="block h-full">
        {InnerCard}
      </Link>
    );
  }

  return (
    <div onClick={onClick} className="block h-full">
      {InnerCard}
    </div>
  );
};
