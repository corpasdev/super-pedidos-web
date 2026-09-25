export interface StoreDataSource {
  id: string
  name: string
}

export interface StoreRepository {
  findStoreIdByOwner(ownerUserId: string): Promise<string | null>
  findById(storeId: string): Promise<StoreDataSource | null>
  createForOwner(ownerUserId: string, name: string): Promise<string>
}