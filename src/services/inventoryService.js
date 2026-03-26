import { supabase } from '../lib/supabase'

export const inventoryService = {
    // BRANDS
    async getBrands() {
        const { data, error } = await supabase.from('brands').select('*').order('name')
        if (error) throw error
        return data
    },

    async createBrand(name) {
        const { data, error } = await supabase.from('brands').insert([{ name }]).select().single()
        if (error) throw error
        return data
    },

    async updateBrand(id, name) {
        const { data, error } = await supabase.from('brands').update({ name }).eq('id', id).select().single()
        if (error) throw error
        return data
    },

    async deleteBrand(id) {
        const { error } = await supabase.from('brands').delete().eq('id', id)
        if (error) throw error
    },

    // CATEGORIES
    async getCategories() {
        const { data, error } = await supabase.from('categories').select('*').order('name')
        if (error) throw error
        return data
    },

    async createCategory(name) {
        const { data, error } = await supabase.from('categories').insert([{ name }]).select().single()
        if (error) throw error
        return data
    },

    async updateCategory(id, name) {
        const { data, error } = await supabase.from('categories').update({ name }).eq('id', id).select().single()
        if (error) throw error
        return data
    },

    async deleteCategory(id) {
        const { error } = await supabase.from('categories').delete().eq('id', id)
        if (error) throw error
    },

    // SUBCATEGORIES
    async getSubcategories(categoryId) {
        let query = supabase.from('subcategories').select('*').order('name')
        if (categoryId) {
            query = query.eq('category_id', categoryId)
        }
        const { data, error } = await query
        if (error) throw error
        return data
    },

    async createSubcategory(name, categoryId) {
        const { data, error } = await supabase.from('subcategories').insert([{ name, category_id: categoryId }]).select().single()
        if (error) throw error
        return data
    },

    async updateSubcategory(id, name, categoryId) {
        const { data, error } = await supabase.from('subcategories').update({ name, category_id: categoryId }).eq('id', id).select().single()
        if (error) throw error
        return data
    },

    async deleteSubcategory(id) {
        const { error } = await supabase.from('subcategories').delete().eq('id', id)
        if (error) throw error
    },

    // MODELS
    async getModels(brandId) {
        let query = supabase.from('models').select('*').order('name')
        if (brandId) {
            query = query.eq('brand_id', brandId)
        }
        const { data, error } = await query
        if (error) throw error
        return data
    },

    async createModel(name, brandId) {
        const { data, error } = await supabase.from('models').insert([{ name, brand_id: brandId }]).select().single()
        if (error) throw error
        return data
    },

    async updateModel(id, name, brandId) {
        const { data, error } = await supabase.from('models').update({ name, brand_id: brandId }).eq('id', id).select().single()
        if (error) throw error
        return data
    },

    async deleteModel(id) {
        const { error } = await supabase.from('models').delete().eq('id', id)
        if (error) throw error
    },

    // IMAGES
    async uploadProductImage(file) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath)

        console.log('Generated Image URL:', data.publicUrl)
        return data.publicUrl
    },

    // MERMAS (DAMAGE TRACKING)
    async reportItemDamage(productId, branchId, quantity, notes) {
        const { data, error } = await supabase.rpc('report_item_damage', {
            p_product_id: productId,
            p_branch_id: branchId,
            p_quantity: quantity,
            p_notes: notes
        })
        if (error) throw error
        return data
    },

    async restoreItemDamage(productId, branchId, quantity, notes) {
        const { data, error } = await supabase.rpc('restore_item_damage', {
            p_product_id: productId,
            p_branch_id: branchId,
            p_quantity: quantity,
            p_notes: notes
        })
        if (error) throw error
        return data
    },

    // BULK IMPORT
    async bulkImportProducts(productList, branchId) {
        // 1. Get unique categories, brands, models
        const uniqueCats = [...new Set(productList.map(p => p.category).filter(Boolean))]
        const uniqueBrands = [...new Set(productList.map(p => p.brand).filter(Boolean))]

        // 2. Resolve/Create Categories
        const { data: existingCats } = await supabase.from('categories').select('*')
        const catMap = {}
        existingCats?.forEach(c => catMap[c.name.toLowerCase()] = c.id)

        for (const catName of uniqueCats) {
            if (!catMap[catName.toLowerCase()]) {
                const { data } = await supabase.from('categories').insert([{ name: catName }]).select().single()
                if (data) catMap[catName.toLowerCase()] = data.id
            }
        }

        // 3. Resolve/Create Brands
        const { data: existingBrands } = await supabase.from('brands').select('*')
        const brandMap = {}
        existingBrands?.forEach(b => brandMap[b.name.toLowerCase()] = b.id)

        for (const brandName of uniqueBrands) {
            if (!brandMap[brandName.toLowerCase()]) {
                const { data } = await supabase.from('brands').insert([{ name: brandName }]).select().single()
                if (data) brandMap[brandName.toLowerCase()] = data.id
            }
        }

        // 4. Resolve/Create Models (simplified: just link to brand if provided)
        const modelsToCreate = productList.filter(p => p.model && p.brand).map(p => ({
            name: p.model,
            brand_id: brandMap[p.brand.toLowerCase()]
        }))
        // We'll just do a quick unique check for models too
        const uniqueModels = []
        const seenModels = new Set()
        modelsToCreate.forEach(m => {
            const key = `${m.name.toLowerCase()}|${m.brand_id}`
            if (!seenModels.has(key)) {
                uniqueModels.push(m)
                seenModels.add(key)
            }
        })

        const { data: existingModels } = await supabase.from('models').select('*')
        const modelMap = {}
        existingModels?.forEach(m => modelMap[`${m.name.toLowerCase()}|${m.brand_id}`] = m.id)

        for (const m of uniqueModels) {
            if (!modelMap[`${m.name.toLowerCase()}|${m.brand_id}`]) {
                const { data } = await supabase.from('models').insert([m]).select().single()
                if (data) modelMap[`${m.name.toLowerCase()}|${m.brand_id}`] = data.id
            }
        }

        // 5. Build Products to Insert
        const productsToInsert = productList.map(p => ({
            sku: p.sku || `IMPORT-${Math.random().toString(36).substr(2, 6)}`,
            name: p.name,
            category_id: p.category ? catMap[p.category.toLowerCase()] : null,
            brand_id: p.brand ? brandMap[p.brand.toLowerCase()] : null,
            model_id: (p.model && p.brand) ? modelMap[`${p.model.toLowerCase()}|${brandMap[p.brand.toLowerCase()]}`] : null,
            price: parseFloat(p.price) || 0,
            cost_price: parseFloat(p.cost) || 0,
            unit_of_measure: p.unit || 'Unid.',
            status: 'Activo'
        }))

        // Insert products (handling duplicates by SKU isn't native in this simple flow, but we can do it if needed)
        const { data: insertedProducts, error: pError } = await supabase.from('products').insert(productsToInsert).select()
        if (pError) throw pError

        // 6. Branch Settings (Stock)
        if (branchId && insertedProducts) {
            const settingsToInsert = insertedProducts.map((p, index) => {
                const original = productList[index]
                return {
                    product_id: p.id,
                    branch_id: branchId,
                    stock: parseFloat(original.stock) || 0,
                    min_stock: parseFloat(original.minStock) || 0,
                    price: p.price
                }
            })
            const { error: sError } = await supabase.from('product_branch_settings').insert(settingsToInsert)
            if (sError) throw sError
        }

        return insertedProducts
    }
}
