import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth/AuthContext'

export type Category = {
  id: string
  user_id: string
  name: string
  icon: string | null
  parent_id: string | null
  color?: string
}

export type CategoryWithSubcategories = Category & {
  subcategories: Category[]
}

export const useCategories = () => {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setCategories([])
      return
    }

    const fetchCategories = async () => {
      setLoading(true)
      setError(null)
      const { data, error: err } = await supabase
        .from('categories')
        .select('*')
        .order('name')

      if (err) {
        setError(err.message)
      } else {
        setCategories(data as Category[])
      }

      setLoading(false)
    }

    void fetchCategories()

    const subscription = supabase
      .channel('public:categories')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        () => {
          void fetchCategories()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(subscription)
    }
  }, [user])

  // Helper functions for hierarchical operations
  const getMainCategories = useCallback(() => categories.filter(cat => !cat.parent_id), [categories])
  const getSubcategories = useCallback((parentId: string) => categories.filter(cat => cat.parent_id === parentId), [categories])
  
  const getCategoryHierarchy = useCallback((categoryId: string | null): string => {
    if (!categoryId) return 'Uncategorized'

    const category = categories.find(cat => cat.id === categoryId)
    if (!category) return 'Unknown'

    if (!category.parent_id) {
      return category.name
    }

    const parentCategory = categories.find(cat => cat.id === category.parent_id)
    return parentCategory ? `${parentCategory.name} > ${category.name}` : category.name
  }, [categories])

  const getCategoriesWithSubcategories = useCallback((): CategoryWithSubcategories[] => {
    const mainCategories = getMainCategories()
    return mainCategories.map(mainCat => ({
      ...mainCat,
      subcategories: getSubcategories(mainCat.id)
    }))
  }, [getMainCategories, getSubcategories])

  return {
    categories,
    loading,
    error,
    setCategories,
    getMainCategories,
    getSubcategories,
    getCategoryHierarchy,
    getCategoriesWithSubcategories
  }
}

