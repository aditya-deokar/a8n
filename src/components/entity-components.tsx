import { PlusIcon, SearchIcon } from "lucide-react";
import { Button } from "./ui/button";
import Link from "next/link";
import { ReactNode } from "react";
import { Input } from "./ui/input";

type EntityHeaderProps = {
    title: string;
    description?: string;
    newButtonLabel?: string;
    disable?: boolean;
    isCreating?: boolean;
} & (
        | {
            onNew: () => void;
            newButtonHref?: never;
        }
        | {
            newButtonHref: string;
            onNew?: never;
        }
        | {
            onNew?: never;
            newButtonHref?: never;
        }
    );

type EntityContainerProps = {
    children: ReactNode;
    header?: ReactNode;
    search?:ReactNode;
    pagination: ReactNode;
} 

export const EntityHeaders = ({
    title,
    description,
    disable,
    isCreating,
    onNew,
    newButtonHref,
    newButtonLabel
}: EntityHeaderProps) => {

    return (
        <div className="flex flex-row items-center justify-between gap-x-4">
            <div className="flex flex-col">
                <h1 className="text-lg md:text-xl font-semibold">{title}</h1>
                {description && (
                    <p className="text-xs md:text-sm text-muted-foreground">{description}</p>
                )}
            </div>

            {onNew && !newButtonHref && (
                <Button 
                    className="" 
                    disabled={isCreating || disable} 
                    size={"sm"} 
                    onClick={onNew}>
                    <PlusIcon className="size-4"/>
                    {newButtonLabel}
                </Button>
            )}

            {!onNew && newButtonHref && (
                <Button 
                    className="" 
                    size={"sm"} 
                    asChild>
                    <Link href={newButtonHref} className="" prefetch >
                         <PlusIcon className="size-4"/>
                        {newButtonLabel}
                    </Link>
                </Button>
            )}
        </div>
    )
}

export const EntityContainer = ({
  children,
  header,
  search,
  pagination,
}: EntityContainerProps) => {
  return (
    <div className="p-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8 h-full">
      <div className="flex flex-col w-full mx-auto max-w-screen-xl gap-y-6 lg:gap-y-8 h-full">
        {header}
        <div className="flex flex-col gap-y-4 h-full">
          {search}
          {children}
          {pagination}
        </div>
      </div>
    </div>
  );
};


interface EntitySearchProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export const EntitySearch= ({onChange, value, placeholder= "Search"}:EntitySearchProps)=>{
    return(
        <div className="relative ml-auto">
            <SearchIcon className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
            <Input 
                className="max-w-[200px] bg-background shadow-none border-border pl-8"
                placeholder={placeholder}
                value={value}
                onChange={(e)=> onChange(e.target.value)}
            />
        </div>
    )
}



interface EntityPaginationProps {
    page: number;
    totalPages: number;
    onPageChange : (page: number)=>void;
    disable?: boolean;
}

export const EntityPagination =({
    page,
    totalPages,
    onPageChange,
    disable,
}: EntityPaginationProps)=>{
    return (
        <div className="flex items-center justify-between gap-x-2 w-full">
            <div className="flex-1 text-sm text-muted-foreground">
                Page {page} of {totalPages || 1}
            </div>

            <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                    disabled={page === 1 || disable}
                    variant={"outline"}
                    size={"sm"}
                    onClick={()=> onPageChange(Math.max(1, page-1))}
                >
                    Previous
                </Button>
                <Button
                    disabled={page === totalPages || totalPages===0 || disable}
                    variant={"outline"}
                    size={"sm"}
                    onClick={()=> onPageChange(Math.min(totalPages, page + 1))}
                >
                    Next
                </Button>
            </div>
        </div>
    )
}