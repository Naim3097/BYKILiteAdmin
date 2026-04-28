import { useState } from 'react'
import { usePartsContext } from '../context/PartsContext'
import { ResponsiveModal } from './ui'

function AddPartForm({ onClose }) {
  const { addPart } = usePartsContext()
  const [formData, setFormData] = useState({
    kodProduk: '',
    namaProduk: '',
    harga: '',
    supplier: '',
    gambar: '',
    specification: '',
    unitStock: ''
  })
  const [selectedFile, setSelectedFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isProcessingImage, setIsProcessingImage] = useState(false)

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.kodProduk.trim()) newErrors.kodProduk = 'Product code is required'
    if (!formData.namaProduk.trim()) newErrors.namaProduk = 'Product name is required'
    if (!formData.harga || parseFloat(formData.harga) <= 0) newErrors.harga = 'Valid price is required'
    if (!formData.supplier.trim()) newErrors.supplier = 'Supplier is required'
    if (!formData.unitStock || parseInt(formData.unitStock) < 0) newErrors.unitStock = 'Valid stock count is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setIsSubmitting(true)
    
    try {
      console.log('Submitting form data:', formData)
      
      // Optimistic update - add to UI immediately
      const optimisticPart = {
        id: `temp-${Date.now()}`,
        ...formData,
        harga: parseFloat(formData.harga),
        unitStock: parseInt(formData.unitStock),
        dateAdded: new Date().toISOString(),
        isOptimistic: true
      }
      
      // Add optimistic part to context (for instant UI update)
      // The addPart function will handle the actual Firebase/localStorage save
      const result = await addPart(formData)
      console.log('Add part result:', result)
      
      // Close immediately after submission starts
      onClose()
    } catch (error) {
      console.error('Error adding part:', error)
      console.error('Error details:', error.message, error.stack)
      
      // Only show alert for real errors, not timeout issues
      if (!error.message.includes('timeout') && !error.message.includes('offline')) {
        alert(`Error adding part: ${error.message || 'Please try again.'}`)
      }
      
      // Still close the form - the part may have been saved to localStorage
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value })
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' })
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file')
        return
      }

      // Validate file size (max 5MB for initial check)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB')
        return
      }

      setSelectedFile(file)
      setIsProcessingImage(true)
      
      // Create preview URL and compress image (optimized for mobile)
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          // Use setTimeout to prevent UI blocking (shorter delay)
          setTimeout(() => {
            try {
              // Create canvas for compression
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d')
              
              // Calculate new dimensions (optimized for speed)
              let { width, height } = img
              const maxDimension = window.innerWidth < 768 ? 400 : 600 // Even smaller for speed
              
              if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                  height = (height * maxDimension) / width
                  width = maxDimension
                } else {
                  width = (width * maxDimension) / height
                  height = maxDimension
                }
              }
              
              canvas.width = width
              canvas.height = height
              
              // Draw and compress (faster settings)
              ctx.drawImage(img, 0, 0, width, height)
              
              // Faster compression settings
              const quality = window.innerWidth < 768 ? 0.6 : 0.8
              const compressedDataUrl = canvas.toDataURL('image/jpeg', quality)
              
              // More lenient size limits for speed
              const sizeLimit = window.innerWidth < 768 ? 400000 : 600000
              if (compressedDataUrl.length > sizeLimit) {
                // Try one more time with higher compression
                const smallerDataUrl = canvas.toDataURL('image/jpeg', 0.4)
                if (smallerDataUrl.length > sizeLimit) {
                  alert('Image is too large. Please use a smaller image.')
                  clearImage()
                  return
                }
                setImagePreview(smallerDataUrl)
                setFormData({ ...formData, gambar: smallerDataUrl })
              } else {
                setImagePreview(compressedDataUrl)
                setFormData({ ...formData, gambar: compressedDataUrl })
              }
            } catch (error) {
              console.error('Image processing error:', error)
              alert('Error processing image. Please try a different image.')
              clearImage()
            } finally {
              setIsProcessingImage(false)
            }
          }, 50) // Reduced from 100ms to 50ms
        }
        img.src = e.target.result
      }
      reader.readAsDataURL(file)
    }
  }

  const clearImage = () => {
    setSelectedFile(null)
    setImagePreview('')
    setIsProcessingImage(false)
    setFormData({ ...formData, gambar: '' })
    // Reset file input
    const fileInput = document.getElementById('image-upload')
    if (fileInput) fileInput.value = ''
  }

  return (
    <ResponsiveModal
      isOpen={true}
      onClose={onClose}
      title="Add New Part"
      size="lg"
      bodyClassName="p-0"
    >
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Mobile-first form layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-black mb-2">
                Product Code *
              </label>
              <input
                type="text"
                value={formData.kodProduk}
                onChange={(e) => handleChange('kodProduk', e.target.value)}
                className={`input-field ${errors.kodProduk ? 'border-primary-red' : ''}`}
                placeholder="e.g., BRK001"
              />
              {errors.kodProduk && (
                <p className="text-primary-red text-sm mt-1">{errors.kodProduk}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-black mb-2">
                Price (RM) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={formData.harga}
                onChange={(e) => handleChange('harga', e.target.value)}
                className={`input-field ${errors.harga ? 'border-primary-red' : ''}`}
                placeholder="0.00"
              />
              {errors.harga && (
                <p className="text-primary-red text-sm mt-1">{errors.harga}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-black mb-2">
              Product Name *
            </label>
            <input
              type="text"
              value={formData.namaProduk}
              onChange={(e) => handleChange('namaProduk', e.target.value)}
              className={`input-field ${errors.namaProduk ? 'border-primary-red' : ''}`}
              placeholder="e.g., Brake Pads - Front"
            />
            {errors.namaProduk && (
              <p className="text-primary-red text-sm mt-1">{errors.namaProduk}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-black mb-2">
                Supplier *
              </label>
              <input
                type="text"
                value={formData.supplier}
                onChange={(e) => handleChange('supplier', e.target.value)}
                className={`input-field ${errors.supplier ? 'border-primary-red' : ''}`}
                placeholder="e.g., AutoParts Co."
              />
              {errors.supplier && (
                <p className="text-primary-red text-sm mt-1">{errors.supplier}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-black mb-2">
                Stock Quantity *
              </label>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={formData.unitStock}
                onChange={(e) => handleChange('unitStock', e.target.value)}
                className={`input-field ${errors.unitStock ? 'border-primary-red' : ''}`}
                placeholder="0"
              />
              {errors.unitStock && (
                <p className="text-primary-red text-sm mt-1">{errors.unitStock}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-black mb-2">
              Product Image <span className="text-black-50">(Optional)</span>
            </label>
            
            {/* Image Preview */}
            {(imagePreview || formData.gambar) && (
              <div className="mb-4">
                <div className="relative inline-block">
                  <img 
                    src={imagePreview || formData.gambar} 
                    alt="Product preview" 
                    className="w-24 h-24 object-cover border border-black-25 rounded"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'block'
                    }}
                  />
                  <div className="w-24 h-24 bg-black-10 border border-black-25 rounded flex items-center justify-center text-black-50 text-sm" style={{display: 'none'}}>
                    Invalid Image
                  </div>
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-primary-red text-primary-white rounded-full text-sm hover:bg-red-700 flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            {/* Image Processing Indicator */}
            {isProcessingImage && (
              <div className="mb-4 p-3 bg-red-10 border border-primary-red rounded-md">
                <div className="flex items-center gap-2">
                  <div className="loading-spinner"></div>
                  <span className="text-sm text-primary-red">Processing image for mobile...</span>
                </div>
              </div>
            )}

            {/* File Upload Option */}
            <div className="space-y-3">
              <div>
                <input
                  type="file"
                  id="image-upload"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label 
                  htmlFor="image-upload"
                  className={`inline-flex items-center px-4 py-2 border border-black-25 rounded-md text-sm font-medium text-primary-black bg-primary-white hover:bg-black-5 cursor-pointer transition-colors ${isProcessingImage ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  {isProcessingImage ? 'Processing...' : 'Upload from Device'}
                </label>
                <p className="text-xs text-black-75 mt-1">
                  Max 5MB • JPG, PNG, GIF supported • Auto-compressed for mobile
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-black-25"></div>
                <span className="text-sm text-black-50">OR</span>
                <div className="flex-1 h-px bg-black-25"></div>
              </div>

              <div>
                <input
                  type="url"
                  value={selectedFile ? '' : formData.gambar}
                  onChange={(e) => {
                    if (!selectedFile) {
                      const url = e.target.value
                      handleChange('gambar', url)
                      setImagePreview('')
                      
                      // Validate URL image size
                      if (url && url.startsWith('http')) {
                        const img = new Image()
                        img.crossOrigin = 'anonymous'
                        img.onload = () => {
                          // Create canvas to check size
                          const canvas = document.createElement('canvas')
                          const ctx = canvas.getContext('2d')
                          canvas.width = img.width
                          canvas.height = img.height
                          ctx.drawImage(img, 0, 0)
                          
                          const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
                          if (dataUrl.length > 500000) { // 500KB limit
                            alert('Image from URL is too large. Please use a smaller image or upload a file for automatic compression.')
                            handleChange('gambar', '')
                            return
                          }
                          
                          setImagePreview(dataUrl)
                          handleChange('gambar', dataUrl)
                        }
                        img.onerror = () => {
                          console.log('Could not validate URL image size')
                        }
                        img.src = url
                      }
                    }
                  }}
                  disabled={!!selectedFile}
                  className={`input-field ${selectedFile ? 'bg-black-5 text-black-50' : ''}`}
                  placeholder="https://example.com/image.jpg"
                />
                <p className="text-xs text-black-75 mt-1">
                  Provide a URL to an image of the part (will be compressed automatically)
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-black mb-2">
              Specifications <span className="text-black-50">(Optional)</span>
            </label>
            <textarea
              value={formData.specification}
              onChange={(e) => handleChange('specification', e.target.value)}
              className="input-field h-20 resize-none"
              placeholder="Technical details, compatibility, dimensions, etc."
            />
          </div>

          {/* Sticky bottom buttons on mobile */}
          <div className="sticky bottom-0 bg-primary-white border-t border-black-10 pt-4 sm:pt-6 -mx-4 sm:-mx-6 px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary order-2 sm:order-1"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary order-1 sm:order-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="loading-spinner"></div>
                    Adding Part...
                  </span>
                ) : (
                  'Add Part'
                )}
              </button>
            </div>
          </div>
        </form>
    </ResponsiveModal>
  )
}

export default AddPartForm
