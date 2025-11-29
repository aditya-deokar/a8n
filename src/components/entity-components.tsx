import { AlertTriangleIcon, Loader2Icon, MoreVerticalIcon, PackageOpenIcon, PlusIcon, SearchIcon, TrashIcon } from "lucide-react";
import { Button } from "./ui/button";
import Link from "next/link";
import { ReactNode } from "react";
import { Input } from "./ui/input";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "./ui/empty";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardTitle } from "./ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";

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


interface StateViewProp {
    message?: string;
}



export const LoadingView =({message}: StateViewProp)=>{
    return (
        <div className="flex justify-center items-center h-full flex-1 flex-col gap-y-4">
            <Loader2Icon className="size-6 animate-spin text-muted-foreground"/>
            {!!message && (
                <p className="text-sm text-muted-foreground">
                    {message}
                </p>
            )}
        </div>
    )
}



export const ErrorView =({message}: StateViewProp)=>{
    return (
        <div className="flex justify-center items-center h-full flex-1 flex-col gap-y-4">
            <AlertTriangleIcon className="size-6 text-muted-foreground"/>
            {!!message && (
                <p className="text-sm text-muted-foreground">
                    {message}
                </p>
            )}
        </div>
    )
}

interface EmptyViewProps extends StateViewProp {
    onNew?: ()=> void
}

export const EmptyView =({message, onNew }:EmptyViewProps)=> {

    return (
        <Empty className="border border-dashed bg-white">
            <EmptyHeader>
                <EmptyMedia variant={"icon"}>
                    <PackageOpenIcon />
                </EmptyMedia>
            </EmptyHeader>
            <EmptyTitle>
                No items
            </EmptyTitle>
            {!!message && (
                <EmptyDescription>
                    {message}
                </EmptyDescription>
            )}
            {!!onNew && (
                <EmptyDescription>
                    <Button onClick={onNew}>
                        Add Item
                    </Button>
                </EmptyDescription>
            )}
        </Empty>
    )

}


interface EntityListProps<T> {
    item: T[];
    renderItem: (item:T, index:number) => React.ReactNode;
    getKey?: (item:T, index:number)=> string | number;
    emptyView?: React.ReactNode;
    className?: string;
}

export function EntityList<T>({item, renderItem, className, emptyView, getKey}: EntityListProps<T>){

    if(item.length === 0 && emptyView){
        return (
            <div className="flex-1 flex justify-center items-center">
                <div className="max-w-sm mx-auto">{emptyView}</div>
            </div>
        )
    }

    return(
        <div className={cn(
            "flex flex-col gap-y-4",
            className
        )}>
            {item.map((item, index)=>{
                return(
                    <div key={getKey ? getKey(item, index) : index}>
                        {renderItem(item, index)}
                    </div>
                )
            })}
        </div>
    )
}

interface EntityItemProps {
    href: string;
    title: string;
    subtitle?: ReactNode;
    image?: ReactNode;
    actions?: React.ReactNode;
    onRemove?: ()=> void | Promise<void>;
    isRemoving?: boolean;
    className?: string;
}

export const EntityItem =({
    href,
    title,
    actions,
    className,
    image,
    isRemoving,
    onRemove,
    subtitle,
}: EntityItemProps)=> {

    const handleRemove = async(e:React.MouseEvent)=>{
        e.preventDefault();
        e.stopPropagation();

        if(isRemoving) return;

        if(onRemove){
            await onRemove()
        }
    }
    return(
        <Link href={href} prefetch>
            <Card className={cn(
                "p-4 shadow-none hover:shadow cursor-pointer transition-all duration-300 ease-in",
                isRemoving && "opacity-50 cursor-not-allowed",
                className
            )}>
                <CardContent className="flex flex-row items-center gap-3">
                    {image}
                    <div>
                        <CardTitle className="text-base font-medium">
                            {title}
                        </CardTitle>
                        {
                            !!subtitle && (
                                <CardDescription className="text-xs">
                                    {subtitle}
                                </CardDescription>
                            )
                        }
                    </div>

                    {(actions || onRemove) && (
                        <div className="flex items-center gap-x-4">
                            {actions}
                            {onRemove && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            size={"icon"}
                                            variant={"ghost"}
                                            onClick={(e)=> e.stopPropagation()}
                                        >
                                            <MoreVerticalIcon className="size-4"/>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        onClick={(e)=> e.stopPropagation()}

                                    >
                                        <DropdownMenuItem onClick={handleRemove}>
                                            <TrashIcon className="size-4 "></TrashIcon>
                                            Delete
                                        </DropdownMenuItem>

                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </Link>
    )
}