import { Avatar, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { searchToken } from '@/services/http/token.http'
import { Daum, IToken } from '@/types/token.type'
import ChainImage from '@/utils/ChainImage'
import { AvatarFallback } from '@radix-ui/react-avatar'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { noop } from 'lodash'
import { useState } from 'react'
import { useDebounce } from 'use-debounce'

const useSpotlightSearch = (
    debouncedSearchTerm: string,
): UseQueryResult<IToken | undefined, Error> => {
    return useQuery({
        queryKey: ["spotlightSearch", debouncedSearchTerm],
        queryFn: async (): Promise<IToken | undefined> => {
            if (!debouncedSearchTerm) return;
            return searchToken({
                params: {
                    currencyAddress: debouncedSearchTerm,
                },
            });
        },
        enabled: !!debouncedSearchTerm,
    });
};

type Props = {
    onAdd: (info: Daum) => void
}

function LogoSelect({
    onAdd
}: Props) {

    const [search, setSearch] = useDebounce('', 500)
    const [selectedToken, setSelectedToken] = useState<Daum | undefined>()

    const info = useSpotlightSearch(search)

    return (
        <DialogContent>
            <Select
                onValueChange={(v) => {
                    const selected = info.data?.data?.find(item => item.id === v);
                    if (selected)
                        setSelectedToken(selected)
                }}

            >
                <SelectTrigger>
                    <SelectValue placeholder='Select a Status to Update' />
                </SelectTrigger>
                <SelectContent>
                    <Input
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search..."
                    />
                    <SelectGroup>
                        {info.isPending && search &&
                            <div className='text-center p-3'>
                                Loading Data...
                            </div>}
                        {!search && <div className='text-center p-3'>
                            Search For a Token
                        </div>}
                        {info.data?.data ? info.data?.data?.map((token, index) => <SelectItem key={token.id} value={token?.id ?? ''}>
                            {token.attributes?.name}
                        </SelectItem>
                        ) : null}
                    </SelectGroup>
                </SelectContent>
            </Select>
            <Button onClick={() => {
                if (selectedToken)
                    onAdd(selectedToken)
            }}>
                Add
            </Button>
        </DialogContent>
    )
}

export default LogoSelect