(function () {
    'use strict';

    const DESKTOP_POSITIONS = [
        [-0.40, -0.30], [-0.39, -0.13], [-0.28, -0.05],
        [-0.40,  0.08], [-0.28,  0.13], [-0.27,  0.34],
        [ 0.40, -0.12], [ 0.27, -0.05], [ 0.40,  0.04],
        [ 0.28,  0.11], [ 0.40,  0.25], [ 0.28,  0.32]
    ];
    const MOBILE_POSITIONS = [
        [-0.37, -0.23], [-0.40, 0], [-0.37, 0.20],
        [ 0.37, -0.23], [ 0.40, 0], [ 0.37, 0.20]
    ];

    class PhotoWall {
        constructor(scene, camera, canvas, entries) {
            this.camera = camera;
            this.canvas = canvas;
            this.entries = entries.filter(item => item && item.src);
            this.group = new THREE.Group();
            this.group.visible = false;
            scene.add(this.group);
            this.raycaster = new THREE.Raycaster();
            this.pointer = new THREE.Vector2();
            this.cards = [];
            this.startedAt = 0;
            this.isShowing = false;
            this.dimmed = false;
            this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            this.galleryButton = document.getElementById('photo-gallery-btn');
            this.lightbox = document.getElementById('photo-lightbox');
            this.lightboxImage = document.getElementById('photo-lightbox-image');
            this.lightboxCaption = document.getElementById('photo-lightbox-caption');
            this.lightboxCounter = document.getElementById('photo-lightbox-counter');
            this.lightboxIndex = 0;
            this.pointerDown = null;

            this.entries.forEach((item, index) => {
                const drawing = document.createElement('canvas');
                drawing.width = 384;
                drawing.height = 480;
                const texture = new THREE.CanvasTexture(drawing);
                texture.minFilter = THREE.LinearFilter;
                const material = new THREE.MeshBasicMaterial({
                    map: texture, transparent: true, opacity: 0,
                    side: THREE.DoubleSide, depthWrite: false, depthTest: false
                });
                const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.25), material);
                mesh.userData.photoIndex = index;
                mesh.renderOrder = 2;
                mesh.visible = false;
                this.group.add(mesh);
                this.cards.push({ mesh, drawing, texture, loaded: false, loading: false });
                this.drawCard(index);
            });

            this.canvas.addEventListener('pointerdown', event => {
                this.pointerDown = {
                    index: this.hitAt(event.clientX, event.clientY),
                    x: event.clientX, y: event.clientY
                };
            });
            this.canvas.addEventListener('pointerup', event => {
                const start = this.pointerDown;
                this.pointerDown = null;
                if (!start || start.index < 0) return;
                if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) return;
                if (this.hitAt(event.clientX, event.clientY) === start.index) this.open(start.index);
            });
            this.canvas.addEventListener('pointercancel', () => { this.pointerDown = null; });
            this.galleryButton.addEventListener('click', () => this.open(0));
            document.getElementById('photo-lightbox-close').addEventListener('click', () => this.close());
            document.getElementById('photo-lightbox-prev').addEventListener('click', () => this.step(-1));
            document.getElementById('photo-lightbox-next').addEventListener('click', () => this.step(1));
            this.lightbox.addEventListener('click', event => {
                if (event.target === this.lightbox) this.close();
            });
            document.addEventListener('keydown', event => {
                if (this.lightbox.hidden) return;
                if (event.key === 'Escape') this.close();
                if (event.key === 'ArrowLeft') this.step(-1);
                if (event.key === 'ArrowRight') this.step(1);
            });
            this.layout();
        }

        drawCard(index, photo) {
            const card = this.cards[index];
            const ctx = card.drawing.getContext('2d');
            const { width, height } = card.drawing;
            ctx.fillStyle = '#fff7f4';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = '#493343';
            ctx.fillRect(16, 16, width - 32, 384);
            if (photo) {
                const boxW = width - 32;
                const boxH = 384;
                const scale = Math.max(boxW / photo.width, boxH / photo.height);
                const sourceW = boxW / scale;
                const sourceH = boxH / scale;
                ctx.drawImage(photo, (photo.width - sourceW) / 2, (photo.height - sourceH) / 2,
                    sourceW, sourceH, 16, 16, boxW, boxH);
            } else {
                ctx.fillStyle = '#e9b7c8';
                ctx.font = 'bold 62px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(String(index + 1).padStart(2, '0'), width / 2, 230);
            }
            ctx.fillStyle = '#4d3548';
            ctx.textAlign = 'center';
            ctx.font = '26px sans-serif';
            const caption = this.entries[index].caption || `照片 ${index + 1}`;
            ctx.fillText(caption.slice(0, 14), width / 2, 445);
            card.texture.needsUpdate = true;
        }

        load(index) {
            const card = this.cards[index];
            if (card.loaded || card.loading) return;
            card.loading = true;
            const photo = new Image();
            photo.onload = () => {
                card.loaded = true;
                card.loading = false;
                this.drawCard(index, photo);
            };
            photo.onerror = () => {
                card.loading = false;
                console.warn('照片未找到：' + this.entries[index].src);
            };
            photo.src = this.entries[index].src;
        }

        layout() {
            const compact = window.innerWidth < 700;
            const positions = compact ? MOBILE_POSITIONS : DESKTOP_POSITIONS;
            const count = Math.min(positions.length, this.cards.length);
            const viewHeight = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
            const viewWidth = viewHeight * this.camera.aspect;
            const cardPixels = compact ? Math.min(66, window.innerWidth * 0.17) : Math.min(126, window.innerWidth * 0.092);
            const worldWidth = cardPixels * viewWidth / window.innerWidth;
            this.cards.forEach((card, index) => {
                card.mesh.visible = index < count;
                if (index >= count) return;
                const [x, y] = positions[index];
                card.baseX = x * viewWidth;
                card.baseY = -y * viewHeight;
                card.baseZ = index % 3 === 0 ? 3 : index % 3 === 1 ? -2 : 0;
                card.mesh.scale.set(worldWidth, worldWidth, 1);
                card.mesh.position.set(card.baseX, card.baseY, card.baseZ);
                this.load(index);
            });
        }

        show() {
            if (!this.entries.length) return;
            this.startedAt = performance.now() / 1000;
            this.isShowing = true;
            this.dimmed = false;
            this.group.visible = true;
            this.galleryButton.style.display = 'inline-flex';
        }

        setDimmed(value) { this.dimmed = value; }

        update(seconds) {
            if (!this.isShowing) return;
            this.cards.forEach((card, index) => {
                if (!card.mesh.visible) return;
                const elapsed = Math.max(0, seconds - this.startedAt - index * 0.09);
                const appear = Math.min(1, elapsed / 0.8);
                card.mesh.material.opacity = appear * (this.dimmed ? 0.2 : 1);
                const bob = this.reducedMotion ? 0 : Math.sin(seconds * (0.7 + index % 4 * 0.09) + index * 1.7) * 0.65;
                card.mesh.position.set(card.baseX, card.baseY + bob, card.baseZ);
                card.mesh.quaternion.copy(this.camera.quaternion);
                if (!this.reducedMotion) card.mesh.rotateZ(Math.sin(seconds * 0.4 + index) * 0.04);
            });
        }

        hitAt(x, y) {
            if (!this.isShowing || this.dimmed || !this.lightbox.hidden) return -1;
            const bounds = this.canvas.getBoundingClientRect();
            this.pointer.set((x - bounds.left) / bounds.width * 2 - 1,
                -(y - bounds.top) / bounds.height * 2 + 1);
            this.raycaster.setFromCamera(this.pointer, this.camera);
            const hits = this.raycaster.intersectObjects(this.cards.filter(card => card.mesh.visible && card.mesh.material.opacity > 0.4).map(card => card.mesh));
            return hits.length ? hits[0].object.userData.photoIndex : -1;
        }

        open(index) {
            if (!this.entries.length) return;
            this.lightboxIndex = (index + this.entries.length) % this.entries.length;
            this.updateLightbox();
            this.lightbox.hidden = false;
            document.getElementById('photo-lightbox-close').focus();
        }

        updateLightbox() {
            const entry = this.entries[this.lightboxIndex];
            this.lightboxImage.src = entry.src;
            this.lightboxImage.alt = entry.caption || `照片 ${this.lightboxIndex + 1}`;
            this.lightboxCaption.textContent = this.lightboxImage.alt;
            this.lightboxCounter.textContent = `${this.lightboxIndex + 1} / ${this.entries.length}`;
        }

        step(delta) {
            this.lightboxIndex = (this.lightboxIndex + delta + this.entries.length) % this.entries.length;
            this.updateLightbox();
        }

        close() {
            this.lightbox.hidden = true;
            this.lightboxImage.removeAttribute('src');
            this.galleryButton.focus();
        }
    }

    window.PhotoWall = PhotoWall;
})();
