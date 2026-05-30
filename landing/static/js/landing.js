const menuItems = document.querySelectorAll('.menu__item')





function removeActiveClass(className){
    const active = document.querySelector(`.${className}`)
    if (active) active.classList.remove(className)
}



menuItems.forEach(item => {
    item.addEventListener("click",function (e){
        const sectionClass = item.getAttribute("data-section")
        const targetSection = document.querySelector(`.${sectionClass}, #${sectionClass}`)
        if (!targetSection) {
            // Not on landing page; let anchor navigate normally (to landing with hash)
            return
        }

        // On landing page: smooth scroll
        e.preventDefault()
        removeActiveClass('menu__item--active')
        item.classList.add("menu__item--active")

        const header = document.querySelector('.header')
        const headerHeight = header ? header.offsetHeight : 0
        const buffer = 12
        const sectionOffsetTop = targetSection.offsetTop - headerHeight - buffer
        window.scrollTo({
            top: sectionOffsetTop,
            behavior : "smooth"
        })
        // Add a transient entrance animation class
        targetSection.classList.add('section-enter')
        setTimeout(() => targetSection.classList.remove('section-enter'), 600)
        history.replaceState(null, '', `#${sectionClass}`)
    })
})

// Utilities
function animateSection(target) {
    if (!target) return
    target.classList.remove('section-enter')
    // Force reflow to restart animation
    void target.offsetWidth
    target.classList.add('section-enter')
    setTimeout(() => target.classList.remove('section-enter'), 600)
}

function scrollToSectionByHash(hash) {
    const clean = (hash || '').replace('#','')
    if (!clean) return
    const target = document.querySelector(`.${clean}, #${clean}`)
    if (!target) return
    const item = document.querySelector(`.menu__item[data-section="${clean}"]`)
    removeActiveClass('menu__item--active')
    if (item) item.classList.add('menu__item--active')
    const header = document.querySelector('.header')
    const headerHeight = header ? header.offsetHeight : 0
    const buffer = 12
    window.scrollTo({ top: target.offsetTop - headerHeight - buffer, behavior: 'smooth' })
    animateSection(target)
}

// Handle direct navigation with hash on landing page and set active state
window.addEventListener('DOMContentLoaded', () => {
    scrollToSectionByHash(window.location.hash)

    // On non-landing pages, ensure no active item stays highlighted
    const onLanding = document.querySelector('.home, #home')
    if (!onLanding) {
        removeActiveClass('menu__item--active')
        return
    }

    // Observe sections for active state while scrolling
    const sectionIds = ['home','aboutus','our-feature','how-it-work','start-planing']
    const sections = sectionIds
        .map(id => document.querySelector(`#${id}, .${id}`))
        .filter(Boolean)

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const id = entry.target.id || ''
            const sectionKey = id || (entry.target.classList[0] || '')
            if (entry.isIntersecting) {
                const item = document.querySelector(`.menu__item[data-section="${sectionKey}"]`)
                if (item) {
                    removeActiveClass('menu__item--active')
                    item.classList.add('menu__item--active')
                }
            }
        })
    }, { rootMargin: '-30% 0px -60% 0px', threshold: [0, 0.15, 0.3, 0.6] })

    sections.forEach(sec => observer.observe(sec))

    // Fallback: on manual scroll, compute active section explicitly (helps short last section)
    const header = document.querySelector('.header')
    const headerHeight = header ? header.offsetHeight : 0
    function setActiveByScrollPosition() {
        const scrollPos = window.scrollY + headerHeight + 16
        const pageBottom = Math.ceil(window.innerHeight + window.scrollY)
        const docHeight = Math.ceil(document.documentElement.scrollHeight)
        let currentKey = null
        // If near bottom, force last section active (helps short final section)
        if (pageBottom >= docHeight - 2 && sections.length) {
            const last = sections[sections.length - 1]
            currentKey = last.id || (last.classList[0] || null)
        } else {
            for (let i = 0; i < sections.length; i++) {
                const sec = sections[i]
                const next = sections[i + 1]
                const secTop = sec.offsetTop
                const nextTop = next ? next.offsetTop : Number.POSITIVE_INFINITY
                if (scrollPos >= secTop && scrollPos < nextTop) {
                    currentKey = sec.id || (sec.classList[0] || null)
                    break
                }
            }
        }
        if (currentKey) {
            const item = document.querySelector(`.menu__item[data-section="${currentKey}"]`)
            if (item) {
                removeActiveClass('menu__item--active')
                item.classList.add('menu__item--active')
            }
        }
    }
    window.addEventListener('scroll', setActiveByScrollPosition, { passive: true })
})

// Ensure after full load (when browser performs its own hash jump) we correct position and animate
window.addEventListener('load', () => {
    // Defer a tick to run after default anchor positioning
    requestAnimationFrame(() => {
        scrollToSectionByHash(window.location.hash)
    })
})

// If user changes hash (e.g., back/forward), animate and adjust
window.addEventListener('hashchange', () => {
    scrollToSectionByHash(window.location.hash)
})