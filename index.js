const { createApp } = Vue;

createApp({
    data() {
        return {
            imageSrc: null,
            imageLoaded: false,
            annotations: [],
            currentSelection: null,
            isSelecting: false,
            isDragging: false,
            dragStartX: 0,
            dragStartY: 0,
            draggingAnnotationId: null,
            startX: 0,
            startY: 0,
            nextId: 1,
            editingId: null,
            formData: {
                type: '',
                subType: '',
                materialId: null,
                description: ''
            }
        };
    },
    mounted() {
        // 监听粘贴事件
        window.addEventListener('paste', this.handlePaste);
    },
    beforeUnmount() {
        window.removeEventListener('paste', this.handlePaste);
        document.removeEventListener('mousemove', this.onDrag);
        document.removeEventListener('mouseup', this.endDrag);
    },
    methods: {
        triggerFileInput() {
            this.$refs.fileInput.click();
        },
        handleFileUpload(event) {
            const file = event.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.imageSrc = e.target.result;
                    this.imageLoaded = true;
                };
                reader.readAsDataURL(file);
            }
        },
        handlePaste(event) {
            const items = event.clipboardData?.items;
            if (!items) return;

            for (let item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        this.imageSrc = e.target.result;
                        this.imageLoaded = true;
                    };
                    reader.readAsDataURL(file);
                    break;
                }
            }
        },
        onImageLoad() {
            this.$nextTick(() => {
                const img = this.$refs.mainImage;
                const canvas = this.$refs.canvas;
                if (img && canvas) {
                    canvas.width = img.offsetWidth;
                    canvas.height = img.offsetHeight;
                }
            });
        },
        startSelection(event) {
            // 检查是否点击在标注框的拖拽区域
            if (event.target.classList.contains('drag-handle')) {
                return;
            }
            
            const rect = this.$refs.canvas.getBoundingClientRect();
            this.isSelecting = true;
            this.startX = event.clientX - rect.left;
            this.startY = event.clientY - rect.top;
            
            // 初始化当前选区
            this.currentSelection = {
                x: Math.round(this.startX),
                y: Math.round(this.startY),
                width: 0,
                height: 0
            };
        },
        updateSelection(event) {
            if (!this.isSelecting) return;

            const rect = this.$refs.canvas.getBoundingClientRect();
            const currentX = event.clientX - rect.left;
            const currentY = event.clientY - rect.top;

            // 实时更新当前选区
            const x = Math.min(this.startX, currentX);
            const y = Math.min(this.startY, currentY);
            const width = Math.abs(currentX - this.startX);
            const height = Math.abs(currentY - this.startY);

            this.currentSelection = {
                x: Math.round(x),
                y: Math.round(y),
                width: Math.round(width),
                height: Math.round(height)
            };
        },
        endSelection(event) {
            if (!this.isSelecting) return;

            const rect = this.$refs.canvas.getBoundingClientRect();
            const endX = event.clientX - rect.left;
            const endY = event.clientY - rect.top;

            const x = Math.min(this.startX, endX);
            const y = Math.min(this.startY, endY);
            const width = Math.abs(endX - this.startX);
            const height = Math.abs(endY - this.startY);

            // 只有当选区大小足够时才保存
            if (width > 10 && height > 10) {
                this.currentSelection = {
                    x: Math.round(x),
                    y: Math.round(y),
                    width: Math.round(width),
                    height: Math.round(height)
                };
            } else {
                // 如果选区太小，清除
                this.currentSelection = null;
            }

            this.isSelecting = false;
        },
        startDrag(event, annotationId) {
            event.stopPropagation();
            this.isDragging = true;
            this.draggingAnnotationId = annotationId;
            this.dragStartX = event.clientX;
            this.dragStartY = event.clientY;
            
            // 添加全局鼠标移动和释放监听
            document.addEventListener('mousemove', this.onDrag);
            document.addEventListener('mouseup', this.endDrag);
        },
        onDrag(event) {
            if (!this.isDragging) return;
            
            const deltaX = event.clientX - this.dragStartX;
            const deltaY = event.clientY - this.dragStartY;
            
            const canvas = this.$refs.canvas;
            const maxX = canvas ? canvas.width : Infinity;
            const maxY = canvas ? canvas.height : Infinity;
            
            // 只允许拖拽临时选区（创建或编辑状态）
            if (this.draggingAnnotationId === 'current' && this.currentSelection) {
                const newX = this.currentSelection.x + deltaX;
                const newY = this.currentSelection.y + deltaY;
                
                this.currentSelection.x = Math.max(0, Math.min(newX, maxX - this.currentSelection.width));
                this.currentSelection.y = Math.max(0, Math.min(newY, maxY - this.currentSelection.height));
            }
            
            this.dragStartX = event.clientX;
            this.dragStartY = event.clientY;
        },
        endDrag() {
            this.isDragging = false;
            this.draggingAnnotationId = null;
            
            // 移除全局监听
            document.removeEventListener('mousemove', this.onDrag);
            document.removeEventListener('mouseup', this.endDrag);
        },
        saveAnnotation() {
            if (!this.currentSelection || !this.formData.type) return;

            const typeLabels = {
                'material': '素材标注',
                'function': '功能标注',
                'basic-component': '基础组件标注',
                'business-component': '业务组件标注'
            };

            const annotation = {
                id: this.editingId || this.nextId++,
                type: this.formData.type,
                typeLabel: typeLabels[this.formData.type],
                subType: this.formData.subType,
                materialId: this.formData.materialId,
                description: this.formData.description,
                x: this.currentSelection.x,
                y: this.currentSelection.y,
                width: this.currentSelection.width,
                height: this.currentSelection.height
            };

            if (this.editingId) {
                // 更新现有标注
                const index = this.annotations.findIndex(a => a.id === this.editingId);
                if (index !== -1) {
                    this.annotations[index] = annotation;
                }
                this.editingId = null;
            } else {
                // 添加新标注
                this.annotations.push(annotation);
            }

            // 重置表单和选区
            this.resetForm();
        },
        resetForm() {
            this.currentSelection = null;
            this.formData = {
                type: '',
                subType: '',
                materialId: null,
                description: ''
            };
        },
        editAnnotation(annotation) {
            this.editingId = annotation.id;
            this.currentSelection = {
                x: annotation.x,
                y: annotation.y,
                width: annotation.width,
                height: annotation.height
            };
            this.formData = {
                type: annotation.type,
                subType: annotation.subType,
                materialId: annotation.materialId,
                description: annotation.description
            };

            // 滚动到顶部以便看到编辑表单
            this.$refs.canvas?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },
        deleteAnnotation(id) {
            if (confirm('确定要删除这条标注记录吗?')) {
                this.annotations = this.annotations.filter(a => a.id !== id);
                if (this.editingId === id) {
                    this.editingId = null;
                    this.resetForm();
                }
            }
        },
        clearImage() {
            if (confirm('清除图片将删除所有标注记录，确定继续吗?')) {
                this.imageSrc = null;
                this.imageLoaded = false;
                this.annotations = [];
                this.nextId = 1;
                this.resetForm();
            }
        },
        clearAllAnnotations() {
            if (confirm('确定要清除所有标注记录吗?')) {
                this.annotations = [];
                this.nextId = 1;
                this.resetForm();
            }
        },
        async exportData() {
            // 1. 导出标注的图片
            await this.exportAnnotatedImage();

            // 2. 导出 JSON 数据
            this.exportJSON();
        },
        async exportAnnotatedImage() {
            const img = this.$refs.mainImage;
            if (!img) return;

            // 创建一个临时 canvas
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');

            // 绘制原图
            ctx.drawImage(img, 0, 0);

            // 计算缩放比例
            const scaleX = img.naturalWidth / img.offsetWidth;
            const scaleY = img.naturalHeight / img.offsetHeight;

            // 绘制所有标注框
            this.annotations.forEach(annotation => {
                const x = annotation.x * scaleX;
                const y = annotation.y * scaleY;
                const width = annotation.width * scaleX;
                const height = annotation.height * scaleY;

                // 绘制红色边框
                ctx.strokeStyle = '#f44336';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, width, height);

                // 绘制 ID 标签
                const fontSize = 24;
                ctx.font = `bold ${fontSize}px Arial`;
                const text = annotation.id.toString();
                const textWidth = ctx.measureText(text).width;
                const padding = 8;

                // 标签背景
                ctx.fillStyle = '#f44336';
                ctx.fillRect(
                    x + width - textWidth - padding * 2,
                    y + height + 5,
                    textWidth + padding * 2,
                    fontSize + padding
                );

                // 标签文字
                ctx.fillStyle = 'white';
                ctx.fillText(text, x + width - textWidth - padding, y + height + fontSize + 5);
            });

            // 下载图片
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `annotated-image-${Date.now()}.png`;
                a.click();
                URL.revokeObjectURL(url);
            });
        },
        exportJSON() {
            const data = {
                exportTime: new Date().toISOString(),
                imageSize: {
                    width: this.$refs.mainImage?.naturalWidth || 0,
                    height: this.$refs.mainImage?.naturalHeight || 0
                },
                annotations: this.annotations.map(annotation => ({
                    id: annotation.id,
                    type: annotation.type,
                    typeLabel: annotation.typeLabel,
                    subType: annotation.subType,
                    materialId: annotation.materialId,
                    description: annotation.description,
                    position: {
                        x: annotation.x,
                        y: annotation.y,
                        width: annotation.width,
                        height: annotation.height
                    }
                }))
            };

            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `annotations-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }
}).mount('#app');