class WorksController < ApplicationController
  def index
    @work = Work.all.sample
  end

  def show
    @work = Work.find_by(slug: params[:slug] || Work.all.sample.slug)
    @slug = @work&.slug.presence || ""
    @description = @work&.description.presence || ""
  end
end
